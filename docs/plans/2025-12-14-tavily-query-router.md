# Tavily Search & Query Router Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add web search capability via Tavily and intelligent query routing for LangGraph agents

**Architecture:** Create Tavily search service as LangChain tool, build GPT-4o-mini powered query router for intent detection, integrate into existing query endpoint with user permission flow for free users

**Tech Stack:** Tavily API, LangChain Tools, OpenAI GPT-4o-mini, FastAPI

---

## Task 1: Tavily Search Service

**Files:**
- Create: `server/app/services/tavily_search.py`
- Modify: `server/app/core/config.py:34`
- Test: Manual API test

**Step 1: Install Tavily SDK**

```bash
cd server && poetry add tavily-python
```

**Step 2: Verify Tavily API key in config**

File: `server/app/core/config.py:34`
Ensure line exists: `tavily_api_key: str = ""`

**Step 3: Create Tavily search service**

File: `server/app/services/tavily_search.py`

```python
from typing import List, Dict, Optional
from tavily import TavilyClient
import logging
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

def search_financial_data(query: str, max_results: int = 5) -> List[Dict]:
    if not settings.tavily_api_key:
        logger.warning("Tavily API key not configured")
        return []

    try:
        client = TavilyClient(api_key=settings.tavily_api_key)

        response = client.search(
            query=query,
            search_depth="advanced",
            max_results=max_results,
            include_domains=["reuters.com", "bloomberg.com", "cnbc.com"],
            topic="finance"
        )

        results = []
        for item in response.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
                "score": item.get("score", 0.0)
            })

        logger.info(f"Tavily search returned {len(results)} results")
        return results

    except Exception as e:
        logger.error(f"Tavily search failed: {str(e)}")
        return []

def format_for_llm(results: List[Dict]) -> str:
    if not results:
        return ""

    formatted_parts = []
    for i, result in enumerate(results, 1):
        formatted_parts.append(
            f"[Web Source {i}] {result['title']}\n"
            f"URL: {result['url']}\n"
            f"{result['content']}\n"
        )

    return "\n".join(formatted_parts)
```

**Step 4: Test Tavily search manually**

Add to `.env`: `TAVILY_API_KEY=tvly-xxx`

Test:
```python
from app.services.tavily_search import search_financial_data
results = search_financial_data("Apple Q4 2024 earnings")
print(results)
```

Expected: List of 5 financial news results

**Step 5: Commit**

```bash
git add server/app/services/tavily_search.py server/pyproject.toml
git commit -m "feat: add Tavily web search service"
```

---

## Task 2: Query Router Service

**Files:**
- Create: `server/app/services/query_router.py`

**Step 1: Create query router with intent classification**

File: `server/app/services/query_router.py`

```python
from typing import Dict, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import logging
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0
)

def classify_query(question: str, user_role: str) -> Dict:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Analyze this financial query and return JSON with:
- intent: factual|comparison|risk|trend|recent_data
- needs_web_search: true if query asks about "latest", "current", "recent", "today", "now"
- agents_needed: list of ["research", "verification", "risk", "synthesis"]
- complexity: simple|medium|complex

Examples:
Q: "What was Q3 revenue?"
A: {{"intent": "factual", "needs_web_search": false, "agents_needed": ["research"], "complexity": "simple"}}

Q: "What's the latest stock price?"
A: {{"intent": "recent_data", "needs_web_search": true, "agents_needed": ["research"], "complexity": "simple"}}

Q: "Compare revenue growth vs competitors"
A: {{"intent": "comparison", "needs_web_search": false, "agents_needed": ["research", "synthesis"], "complexity": "medium"}}

Q: "What are the major risks?"
A: {{"intent": "risk", "needs_web_search": false, "agents_needed": ["research", "risk", "verification"], "complexity": "medium"}}

Return only valid JSON."""),
        ("user", "{question}")
    ])

    try:
        chain = prompt | llm
        response = chain.invoke({"question": question})

        import json
        result = json.loads(response.content)

        if user_role == "free" and result.get("needs_web_search"):
            result["requires_permission"] = True

        logger.info(f"Query classified: {result}")
        return result

    except Exception as e:
        logger.error(f"Query classification failed: {str(e)}")
        return {
            "intent": "factual",
            "needs_web_search": False,
            "agents_needed": ["research"],
            "complexity": "simple",
            "requires_permission": False
        }
```

**Step 2: Test router manually**

```python
from app.services.query_router import classify_query
result = classify_query("What's the latest revenue?", "free")
print(result)
```

Expected: `{"intent": "recent_data", "needs_web_search": true, ...}`

**Step 3: Commit**

```bash
git add server/app/services/query_router.py
git commit -m "feat: add query router with intent classification"
```

---

## Task 3: Integrate into Query Endpoint

**Files:**
- Modify: `server/app/api/queries.py`

**Step 1: Import new services**

Add to imports:
```python
from app.services.query_router import classify_query
from app.services.tavily_search import search_financial_data, format_for_llm
```

**Step 2: Add router before vector search**

After line 34 (`question = request.question`), add:

```python
# Route query to determine if web search needed
route_info = classify_query(question, current_user["role"])
logger.info(f"Query routed: {route_info}")

# Check if free user needs permission for web search
if route_info.get("requires_permission"):
    yield f"data: {json.dumps({'type': 'permission_required', 'message': 'This query requires web search (Pro feature). Proceed?'})}\n\n"
    # For now, skip web search for free users
    route_info["needs_web_search"] = False
```

**Step 3: Add Tavily search after vector search**

After reranking (line 103), add:

```python
web_context = ""
if route_info.get("needs_web_search") and current_user["role"] in ["admin", "premium"]:
    web_results = search_financial_data(question)
    if web_results:
        web_context = "\n\n--- WEB SEARCH RESULTS ---\n" + format_for_llm(web_results)
        logger.info(f"Added {len(web_results)} web results to context")
```

**Step 4: Modify LLM context to include web results**

Before `generate_answer()` call (line 106), modify chunks parameter:

Change from:
```python
for event in generate_answer(
    question=request.question,
    chunks=reranked_chunks,
    stream=True
):
```

To:
```python
for event in generate_answer(
    question=request.question,
    chunks=reranked_chunks,
    web_context=web_context,
    stream=True
):
```

**Step 5: Update LLM service to accept web context**

File: `server/app/services/llm_service.py`

Change function signature (line 17):
```python
def generate_answer(question: str, chunks: List[Dict], web_context: str = "", stream: bool = False) -> Dict:
```

Add web context to prompt (after line 28):
```python
context = "\n\n".join(context_parts)

if web_context:
    context += web_context
```

**Step 6: Test end-to-end**

Start server: `uvicorn app.main:app --reload`

Test query: "What's the latest Apple stock price?"

Expected: Router detects `needs_web_search: true`, Tavily fetches results, LLM uses both document + web context

**Step 7: Commit**

```bash
git add server/app/api/queries.py server/app/services/llm_service.py
git commit -m "feat: integrate Tavily search and query router into query endpoint"
```

---

## Task 4: Add Environment Variable

**Files:**
- Modify: `server/.env.example`

**Step 1: Document Tavily API key**

Add to `.env.example`:
```
TAVILY_API_KEY=tvly-your-api-key-here
```

**Step 2: Commit**

```bash
git add server/.env.example
git commit -m "docs: add Tavily API key to env example"
```

---

## Verification Steps

1. **Router test:** "What was Q3 revenue?" → `needs_web_search: false`
2. **Tavily test:** "Latest Apple news" → `needs_web_search: true`, fetches web results
3. **Permission flow:** Free user asks recent query → blocked or notified
4. **Combined results:** Admin/Premium sees both document + web data in answer

---

## Next Phase: LangGraph Agents

After this plan:
- Create `server/app/agents/state.py` - Define AgentState
- Build 5 agents using router output
- Replace simple LLM call with agent orchestration
