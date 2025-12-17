from typing import Dict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import logging
import json
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
- needs_web_search: true ONLY if asking about real-time data like "stock price now", "trading today", "market news". Do NOT set true for "latest earnings" from documents.
- agents_needed: list from ["research", "verification", "risk", "synthesis"]
- complexity: simple|medium|complex

AGENT SELECTION RULES:
- "research": ALWAYS include - extracts data from documents/web
- "verification": Include when accuracy is critical (financial numbers, comparisons, claims)
- "risk": Include when asking about risks, challenges, threats, or financial health
- "synthesis": Include for multi-part questions or comparisons

Examples:
Q: "What was Q3 revenue?"
A: {{"intent": "factual", "needs_web_search": false, "agents_needed": ["research", "synthesis"], "complexity": "simple"}}

Q: "What's the current stock price?"
A: {{"intent": "recent_data", "needs_web_search": true, "agents_needed": ["research", "synthesis"], "complexity": "simple"}}

Q: "What are the risks mentioned in the report?"
A: {{"intent": "risk", "needs_web_search": false, "agents_needed": ["research", "risk", "synthesis"], "complexity": "medium"}}

Q: "Compare revenue and profit across quarters with risk analysis"
A: {{"intent": "comparison", "needs_web_search": false, "agents_needed": ["research", "verification", "risk", "synthesis"], "complexity": "complex"}}

Q: "Is the revenue figure of 718 crore accurate?"
A: {{"intent": "factual", "needs_web_search": false, "agents_needed": ["research", "verification", "synthesis"], "complexity": "medium"}}

Q: "Give me complete financial analysis with current stock price"
A: {{"intent": "comparison", "needs_web_search": true, "agents_needed": ["research", "verification", "risk", "synthesis"], "complexity": "complex"}}

Return only valid JSON."""),
        ("user", "{question}")
    ])

    try:
        chain = prompt | llm
        response = chain.invoke({"question": question})

        result = json.loads(response.content)

        if user_role == "free" and result.get("needs_web_search"):
            result["requires_permission"] = True
        else:
            result["requires_permission"] = False

        logger.info(f"Query classified: intent={result.get('intent')}, web_search={result.get('needs_web_search')}")
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
