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
- needs_web_search: true if query asks about "latest", "current", "recent", "today", "now", "this week", "this month"
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
