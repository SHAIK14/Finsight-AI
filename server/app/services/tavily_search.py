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
            include_domains=[
                "moneycontrol.com",
                "economictimes.indiatimes.com",
                "screener.in",
                "bseindia.com",
                "nseindia.com",
                "livemint.com",
                "businesstoday.in",
                "tickertape.in",
                "reuters.com",
                "bloomberg.com"
            ],
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

        logger.info(f"Tavily search returned {len(results)} results for: {query}")
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
