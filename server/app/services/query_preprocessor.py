from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.core.config import get_settings
from typing import Optional

settings = get_settings()
llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0,
)

def preprocess_query(raw_query: str, enable: bool = True) -> str:
    if not enable or not raw_query.strip():
        return raw_query

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", """You are a financial query normalizer. Expand abbreviations and make queries more formal for better document search.

Rules:
- Expand stock tickers to full company names (AAPL → Apple Inc., TSLA → Tesla Inc.)
- Expand quarter abbreviations (Q1 → first quarter, Q2 → second quarter, Q3 → third quarter, Q4 → fourth quarter)
- Expand financial abbreviations (rev → revenue, YoY → year over year, EBITDA → earnings before interest taxes depreciation and amortization, EPS → earnings per share)
- Keep the EXACT same meaning, just more formal and complete
- Don't add information that wasn't in the original query
- Don't change the question type"""),
        ("user", "Rewrite this financial query to be more complete and formal:\n\nOriginal query: {query}\n\nRewritten query:")
    ])

    try:
        chain = prompt_template | llm | StrOutputParser()
        normalized_query = chain.invoke({"query": raw_query})

        print(f"[Query Preprocessing]")
        print(f"  Original: {raw_query}")
        print(f"  Normalized: {normalized_query}")

        return normalized_query.strip()

    except Exception as e:
        print(f"Query preprocessing failed: {e}. Using original query.")
        return raw_query

