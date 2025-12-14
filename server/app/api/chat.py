from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.services.supabase_client import supabase
from app.services.document_processor import process_document
from app.services.vector_search import embed_question, search_similar_chunks
from app.services.reranker import rerank_chunks
from app.services.query_preprocessor import preprocess_query
from app.services.redis_cache import cache_service
from app.services.query_router import classify_query
from app.services.tavily_search import search_financial_data
from app.agents.supervisor import agent_graph
from app.services.chat_session import (
    create_session,
    get_session,
    get_user_sessions,
    get_session_messages,
    save_message,
    delete_session
)
from app.services.query_rewriter import rewrite_query_with_history

router = APIRouter(
    prefix="/api/chat-sessions",
    tags=["chat_sessions"]
)

settings = get_settings()


class ChatQueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    document_ids: Optional[List[str]] = None


@router.post("/sessions/create")
async def create_chat_session(current_user: dict = Depends(get_current_user)):
    session = create_session(current_user["clerk_id"])
    return {"session_id": session["id"], "created_at": session["created_at"]}


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    sessions = get_user_sessions(current_user["clerk_id"])
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["clerk_id"] != current_user["clerk_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = get_session_messages(session_id)
    return {
        "session": session,
        "messages": messages
    }


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["clerk_id"] != current_user["clerk_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    deleted = delete_session(session_id)
    return {"success": deleted}


@router.post("/query")
async def chat_query(
    request: ChatQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    clerk_id = current_user["clerk_id"]
    original_question = request.question

    async def event_generator():
        try:
            if current_user["role"] == "free":
                if current_user["queries_this_month"] >= settings.free_query_limit:
                    yield f"data: {json.dumps({'type': 'error', 'content': 'Query limit reached'})}\n\n"
                    return

            session_id = request.session_id
            if not session_id:
                session = create_session(clerk_id)
                session_id = session["id"]
                yield f"data: {json.dumps({'type': 'session_created', 'session_id': session_id})}\n\n"

            conversation_history = get_session_messages(session_id, limit=10)

            rewritten_question = rewrite_query_with_history(
                original_question,
                conversation_history
            )

            doc_query = supabase.table("documents").select("*").eq("clerk_id", clerk_id)

            if request.document_ids:
                doc_query = doc_query.in_("id", request.document_ids)

            docs_response = doc_query.execute()

            if not docs_response.data:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No documents found'})}\n\n"
                return

            actual_doc_ids = [doc["id"] for doc in docs_response.data]

            for doc in docs_response.data:
                if doc["status"] == "pending":
                    await process_document(doc["id"], supabase)

            route_info = classify_query(rewritten_question, current_user["role"])
            print(f"🧭 Query routed: {route_info}")

            if route_info.get("requires_permission"):
                yield f"data: {json.dumps({'type': 'info', 'content': 'This query requires web search (Pro/Admin feature). Searching documents only...'})}\n\n"
                route_info["needs_web_search"] = False

            normalized_query = preprocess_query(rewritten_question)

            cached_chunks = cache_service.get_search_chunks(normalized_query, actual_doc_ids)

            if cached_chunks:
                reranked_chunks = cached_chunks
            else:
                question_embedding = embed_question(normalized_query)
                chunks = search_similar_chunks(
                    supabase=supabase,
                    question_embedding=question_embedding,
                    document_id=actual_doc_ids,
                    top_k=20
                )
                reranked_chunks = rerank_chunks(
                    query=rewritten_question,
                    chunks=chunks,
                    top_n=5
                )
                cache_service.set_search_chunks(normalized_query, actual_doc_ids, reranked_chunks)

            web_results = []
            if route_info.get("needs_web_search") and current_user["role"] in ["admin", "premium"]:
                print(f"🌐 Activating web search for: {rewritten_question}")
                web_results = search_financial_data(rewritten_question)
                if web_results:
                    print(f"✅ Added {len(web_results)} web results to context")

            print(f"🤖 Invoking agent graph...")
            print(f"📦 [Agent Input] Chunks count: {len(reranked_chunks)}")
            print(f"📦 [Agent Input] Chunks type: {type(reranked_chunks)}")
            if reranked_chunks:
                print(f"📦 [Agent Input] First chunk type: {type(reranked_chunks[0])}")
                print(f"📦 [Agent Input] First chunk sample: {str(reranked_chunks[0])[:200]}")

            initial_state = {
                "messages": [],
                "question": rewritten_question,
                "original_question": original_question,
                "session_id": session_id,
                "conversation_history": conversation_history,
                "route_info": route_info,
                "chunks": reranked_chunks,
                "web_results": web_results,
                "research_output": "",
                "verification_output": "",
                "risk_output": "",
                "final_answer": "",
                "next_agent": ""
            }

            result = agent_graph.invoke(initial_state)
            full_answer = result["final_answer"]
            print(f"✅ Agent graph completed. Answer length: {len(full_answer)} characters")

            save_message(session_id, "user", original_question, None)
            save_message(session_id, "assistant", full_answer, reranked_chunks)

            chunk_size = 5
            for i in range(0, len(full_answer), chunk_size):
                chunk = full_answer[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'sources': reranked_chunks, 'session_id': session_id})}\n\n"

            try:
                supabase.table("users").update({
                    "queries_this_month": current_user["queries_this_month"] + 1
                }).eq("id", current_user["id"]).execute()
            except Exception:
                pass

        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ [CHAT ERROR] {str(e)}")
            print(f"📋 [TRACEBACK]\n{error_trace}")

            error_event = {
                "type": "error",
                "content": str(e)
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
