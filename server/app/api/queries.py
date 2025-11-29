from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.services.supabase_client import supabase

router = APIRouter(prefix="/api/queries", tags=["queries"])
settings = get_settings()


class QueryRequest(BaseModel):
    question: str
    document_ids: Optional[List[str]] = None  # If empty, query all user's documents


class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]
    cached: bool = False


@router.post("/ask")
async def ask_question(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ask a question about uploaded documents

    Flow:
    1. Check query limit (free = 5/month)
    2. Check if user has documents
    3. TODO: Implement RAG pipeline
       - Embed question
       - Vector search in chunks
       - Send to multi-agent system
       - Return answer with sources
    4. Cache response in Redis
    5. Increment query count

    For MVP: Return mock response
    """

    # Check query limit
    if current_user["role"] == "free":
        if current_user["queries_this_month"] >= settings.free_query_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Query limit reached ({settings.free_query_limit}/month for free tier)"
            )

    # Get user's documents
    doc_query = supabase.table("documents").select("id, file_name, company_name").eq(
        "clerk_id", current_user["clerk_id"]
    )

    # Filter by specific documents if provided
    if request.document_ids:
        doc_query = doc_query.in_("id", request.document_ids)

    docs_response = doc_query.execute()

    if not docs_response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents found. Please upload a document first."
        )

    # TODO: Implement RAG pipeline
    # For MVP, return a mock response
    mock_answer = f"""Based on the uploaded documents, here's what I found:

**Answer:** {request.question}

This is a mock response. The RAG pipeline with multi-agent system will be implemented next.

**Documents analyzed:**
{', '.join([doc['file_name'] for doc in docs_response.data])}

**Next steps:**
1. Implement document chunking and embedding
2. Set up vector search with pgvector
3. Integrate multi-agent system (Research, Verification, Risk, Synthesis)
4. Add Redis caching for responses
"""

    mock_sources = [
        {
            "document_id": doc["id"],
            "document_name": doc["file_name"],
            "page_number": 1,
            "relevance_score": 0.95
        }
        for doc in docs_response.data[:2]  # Return top 2 sources
    ]

    # Increment query count
    try:
        supabase.table("users").update({
            "queries_this_month": current_user["queries_this_month"] + 1
        }).eq("id", current_user["id"]).execute()
    except Exception:
        pass  # Don't fail query if count update fails

    return {
        "answer": mock_answer,
        "sources": mock_sources,
        "cached": False,
        "query_id": "mock-query-id"
    }


@router.get("/history")
async def get_query_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's query history

    Returns recent queries with answers
    """
    # TODO: Implement after queries table is set up
    return {
        "queries": [],
        "message": "Query history not yet implemented"
    }
