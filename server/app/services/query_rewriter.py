from typing import List, Dict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import get_settings

settings = get_settings()

llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0
)


def rewrite_query_with_history(
    current_query: str,
    conversation_history: List[Dict]
) -> str:
    if not conversation_history or len(conversation_history) == 0:
        return current_query

    history_text = "\n".join([
        f"{msg['role'].capitalize()}: {msg['content']}"
        for msg in conversation_history[-(5*2):]
    ])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a query rewriting assistant for a financial document QA system.

Your job: Rewrite the current question to be standalone by incorporating relevant context from the conversation history.

CRITICAL RULES:
1. Resolve all pronouns (it, they, this, that) with specific entities from history
2. Add missing context (company names, time periods) from previous questions
3. PRESERVE temporal references EXACTLY as mentioned in history:
   - If history mentions "last quarter", keep "last quarter"
   - If history mentions "Q2 FY26", keep "Q2 FY26"
   - If history mentions "September 30, 2025", keep that date
   - DO NOT change "last quarter" to "fourth quarter" or vice versa
4. Keep the question concise but complete
5. Preserve the user's intent exactly
6. If the question is already standalone, return it unchanged

Examples:
History: "User: What were Apple's Q3 earnings?
          Assistant: Apple's Q3 earnings were $500M..."
Current: "What about sales?"
Rewritten: "What were Apple's Q3 sales figures?"

History: "User: Tell me about the company's risks in the last quarter
          Assistant: The company faces market and credit risks in the last quarter..."
Current: "What about revenue?"
Rewritten: "What about the company's revenue in the last quarter?"

History: "User: Show me Hindustan Copper's data for Q2 FY 2025
          Assistant: Here is Hindustan Copper's Q2 FY 2025 data..."
Current: "What about their profit?"
Rewritten: "What about Hindustan Copper's profit for Q2 FY 2025?"

IMPORTANT: Copy temporal references (quarters, fiscal years, dates) EXACTLY from the conversation history.
"""),
        ("user", """Conversation history:
{history}

Current question: {question}

Rewrite this question to be standalone (return ONLY the rewritten question):""")
    ])

    chain = prompt | llm

    try:
        response = chain.invoke({
            "history": history_text,
            "question": current_query
        })

        rewritten = response.content.strip()
        print(f"[Query Rewriting]")
        print(f"  Original: {current_query}")
        print(f"  Rewritten: {rewritten}")

        return rewritten

    except Exception as e:
        print(f"Query rewriting failed: {str(e)}, using original query")
        return current_query
