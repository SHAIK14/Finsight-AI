from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.services.supabase_client import supabase
from app.services.document_processor import process_document
from app.services.hybrid_search import hybrid_search
from app.services.reranker import rerank_chunks
from app.services.query_preprocessor import preprocess_query
from app.services.redis_cache import cache_service
from app.services.query_router import classify_query
from app.services.tavily_search import search_financial_data
from app.agents.supervisor import agent_graph, pre_synthesis_graph
from app.agents.synthesis import stream_synthesis
from app.agents.reflection import reflection_agent
from app.agents.research import research_agent
from app.agents.verification import verification_agent
from app.agents.risk import risk_agent
import time
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
            # Step 1: Rate limit check
            if current_user["role"] == "free":
                if current_user["queries_this_month"] >= settings.free_query_limit:
                    yield f"data: {json.dumps({'type': 'error', 'content': 'Query limit reached'})}\n\n"
                    return

            # Step 2: Create or retrieve session
            session_id = request.session_id
            if not session_id:
                session = create_session(clerk_id)
                session_id = session["id"]
                yield f"data: {json.dumps({'type': 'session_created', 'session_id': session_id})}\n\n"

            # Status update: Starting
            yield f"data: {json.dumps({'type': 'status', 'content': 'Loading conversation history...'})}\n\n"

            conversation_history = get_session_messages(session_id, limit=10)

            # Status update: Rewriting query
            yield f"data: {json.dumps({'type': 'status', 'content': 'Understanding your question...'})}\n\n"

            rewritten_question = rewrite_query_with_history(
                original_question,
                conversation_history
            )

            # Status update: Loading documents
            yield f"data: {json.dumps({'type': 'status', 'content': 'Loading your documents...'})}\n\n"

            doc_query = supabase.table("documents").select("*").eq("clerk_id", clerk_id)

            if request.document_ids:
                doc_query = doc_query.in_("id", request.document_ids)

            docs_response = doc_query.execute()

            if not docs_response.data:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No documents found'})}\n\n"
                return

            actual_doc_ids = [doc["id"] for doc in docs_response.data]

            # Process pending documents
            for doc in docs_response.data:
                if doc["status"] == "pending":
                    doc_name = doc.get("file_name", "document")
                    yield f"data: {json.dumps({'type': 'status', 'content': f'Processing {doc_name}...'})}\n\n"
                    await process_document(doc["id"], supabase)

            # Status update: Routing query
            yield f"data: {json.dumps({'type': 'status', 'content': 'Analyzing query type...'})}\n\n"

            print(f"🔄 [ASYNC] Running classify_query in thread pool...")
            route_info = await asyncio.to_thread(classify_query, rewritten_question, current_user["role"])
            print(f"🧭 Query routed: {route_info}")

            if route_info.get("requires_permission"):
                yield f"data: {json.dumps({'type': 'info', 'content': 'This query requires web search (Pro/Admin feature). Searching documents only...'})}\n\n"
                route_info["needs_web_search"] = False

            normalized_query = preprocess_query(rewritten_question)

            # Status update: Checking cache
            print(f"🔍 [CACHE] Checking cache for query: {normalized_query[:50]}...")
            cached_chunks = cache_service.get_search_chunks(normalized_query, actual_doc_ids)

            if cached_chunks:
                print(f"⚡ [CACHE HIT] Retrieved {len(cached_chunks)} cached chunks")
                yield f"data: {json.dumps({'type': 'status', 'content': 'Retrieved from cache ⚡'})}\n\n"
                reranked_chunks = cached_chunks
            else:
                print(f"❌ [CACHE MISS] No cached results found")

                doc_names = [doc.get("file_name", "Unknown") for doc in docs_response.data]
                doc_names_str = ", ".join(doc_names[:2])
                if len(doc_names) > 2:
                    doc_names_str += f" and {len(doc_names) - 2} more"

                yield f"data: {json.dumps({'type': 'status', 'content': f'Searching {doc_names_str}...'})}\n\n"
                print(f"🔍 [HYBRID SEARCH] Searching across {len(actual_doc_ids)} documents")
                chunks = await asyncio.to_thread(
                    hybrid_search,
                    query=normalized_query,
                    document_ids=actual_doc_ids,
                    top_k=20,
                    vector_weight=0.5
                )
                print(f"✅ [HYBRID SEARCH] Found {len(chunks)} relevant chunks")

                # Status update: Reranking
                yield f"data: {json.dumps({'type': 'status', 'content': f'Reranking {len(chunks)} chunks for relevance...'})}\n\n"
                print(f"🔀 [RERANKING] Reranking {len(chunks)} chunks to top 5...")
                print(f"🔄 [ASYNC] Running rerank_chunks in thread pool...")
                reranked_chunks = await asyncio.to_thread(
                    rerank_chunks,
                    query=rewritten_question,
                    chunks=chunks,
                    top_n=5
                )
                print(f"✅ [RERANKING] Top {len(reranked_chunks)} chunks selected")
                cache_service.set_search_chunks(normalized_query, actual_doc_ids, reranked_chunks)

            web_results = []
            if route_info.get("needs_web_search") and current_user["role"] in ["admin", "premium"]:
                # Status update: Web search
                yield f"data: {json.dumps({'type': 'status', 'content': 'Searching the web for recent data... 🌐'})}\n\n"
                print(f"🌐 Activating web search for: {rewritten_question}")
                print(f"🔄 [ASYNC] Running search_financial_data in thread pool...")
                web_results = await asyncio.to_thread(search_financial_data, rewritten_question)
                if web_results:
                    print(f"✅ Added {len(web_results)} web results to context")
                    # Stream web results immediately
                    yield f"data: {json.dumps({'type': 'web_search', 'sources': web_results})}\n\n"

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
                "next_agent": "",
                "reflection_passed": False
            }

            agents_needed = route_info.get("agents_needed", ["research"])
            current_state = initial_state.copy()

            # Research Agent (always runs)
            yield f"data: {json.dumps({'type': 'status', 'content': 'Research agent analyzing...'})}\n\n"
            print(f"🔍 [AGENT] Research agent starting...")
            current_state = await asyncio.to_thread(research_agent, current_state)
            yield f"data: {json.dumps({'type': 'status', 'content': 'Research complete ✓'})}\n\n"
            print(f"✅ [AGENT] Research agent complete")

            # Verification Agent (if needed)
            if "verification" in agents_needed:
                yield f"data: {json.dumps({'type': 'status', 'content': 'Verification agent checking facts...'})}\n\n"
                print(f"🔍 [AGENT] Verification agent starting...")
                current_state = await asyncio.to_thread(verification_agent, current_state)
                yield f"data: {json.dumps({'type': 'status', 'content': 'Verification complete ✓'})}\n\n"
                print(f"✅ [AGENT] Verification agent complete")

            # Risk Agent (if needed)
            if "risk" in agents_needed:
                yield f"data: {json.dumps({'type': 'status', 'content': 'Risk agent assessing...'})}\n\n"
                print(f"🔍 [AGENT] Risk agent starting...")
                current_state = await asyncio.to_thread(risk_agent, current_state)
                yield f"data: {json.dumps({'type': 'status', 'content': 'Risk assessment complete ✓'})}\n\n"
                print(f"✅ [AGENT] Risk agent complete")

            yield f"data: {json.dumps({'type': 'status', 'content': 'Generating response...'})}\n\n"
            print(f"🔄 [SYNTHESIS] Starting token streaming...")
            
            full_answer = ""
            token_count = 0
            token_buffer = ""
            
            for token in stream_synthesis(current_state):
                full_answer += token
                token_buffer += token
                token_count += 1
                
                # Send tokens in small batches (every 3-5 tokens or on whitespace)
                if len(token_buffer) >= 4 or token in [" ", "\n", ".", ",", "!", "?"]:
                    yield f"data: {json.dumps({'type': 'token', 'content': token_buffer})}\n\n"
                    token_buffer = ""
                    await asyncio.sleep(0.01)  # Small delay to force flush
                
                if token_count % 50 == 0:
                    print(f"📝 [STREAMING] {token_count} tokens sent...")
            
            # Send any remaining buffer
            if token_buffer:
                yield f"data: {json.dumps({'type': 'token', 'content': token_buffer})}\n\n"
            
            print(f"✅ [SYNTHESIS] Complete. {token_count} tokens, {len(full_answer)} chars")
            
            current_state["final_answer"] = full_answer
            yield f"data: {json.dumps({'type': 'status', 'content': 'Quality check...'})}\n\n"
            
            print(f"🔍 [REFLECTION] Running quality check...")
            final_state = await asyncio.to_thread(reflection_agent, current_state)
            full_answer = final_state.get("final_answer", full_answer)
            
            if final_state.get("final_answer") != current_state.get("final_answer"):
                disclaimer = final_state["final_answer"][len(current_state["final_answer"]):]
                if disclaimer:
                    yield f"data: {json.dumps({'type': 'token', 'content': disclaimer})}\n\n"
            
            print(f"✅ [REFLECTION] Complete")

            save_message(session_id, "user", original_question, None)
            save_message(session_id, "assistant", full_answer, reranked_chunks)

            completion_data = {
                'type': 'done',
                'sources': reranked_chunks,
                'web_sources': web_results if web_results else [],
                'session_id': session_id
            }
            yield f"data: {json.dumps(completion_data)}\n\n"

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
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream",
            "Transfer-Encoding": "chunked",
        }
    )
