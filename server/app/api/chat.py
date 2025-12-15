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

                # Status update: Embedding
                yield f"data: {json.dumps({'type': 'status', 'content': 'Embedding your question...'})}\n\n"
                print(f"🔢 [EMBEDDING] Generating embeddings for query...")
                print(f"🔄 [ASYNC] Running embed_question in thread pool...")
                question_embedding = await asyncio.to_thread(embed_question, normalized_query)
                print(f"✅ [EMBEDDING] Generated {len(question_embedding)} dimensional embedding")

                # Get document names for better status message
                doc_names = [doc.get("file_name", "Unknown") for doc in docs_response.data]
                doc_names_str = ", ".join(doc_names[:2])  # Show first 2 documents
                if len(doc_names) > 2:
                    doc_names_str += f" and {len(doc_names) - 2} more"

                # Status update: Vector search with document names
                yield f"data: {json.dumps({'type': 'status', 'content': f'Searching {doc_names_str}...'})}\n\n"
                print(f"🔍 [VECTOR SEARCH] Searching across {len(actual_doc_ids)} documents: {doc_names}")
                print(f"🔄 [ASYNC] Running search_similar_chunks in thread pool...")
                chunks = await asyncio.to_thread(
                    search_similar_chunks,
                    supabase=supabase,
                    question_embedding=question_embedding,
                    document_id=actual_doc_ids,
                    top_k=20
                )
                print(f"✅ [VECTOR SEARCH] Found {len(chunks)} relevant chunks")

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

            print(f"🤖 [AGENT GRAPH] Starting agent graph with streaming...")
            print(f"📦 [AGENT INPUT] Chunks count: {len(reranked_chunks)}")
            print(f"📦 [AGENT INPUT] Chunks type: {type(reranked_chunks)}")
            if reranked_chunks:
                print(f"📦 [AGENT INPUT] First chunk type: {type(reranked_chunks[0])}")
                print(f"📦 [AGENT INPUT] First chunk sample: {str(reranked_chunks[0])[:200]}")

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

            # Agent name mapping for better status messages
            agent_display_names = {
                "research": "Research agent analyzing documents",
                "verification": "Verification agent checking facts",
                "risk": "Risk analysis agent evaluating concerns",
                "synthesis": "Synthesis agent generating final answer"
            }

            # Stream agent graph execution (CRITICAL: This replaces invoke())
            print(f"🔄 [STREAMING] Starting agent_graph.stream() with mode='updates'")
            full_answer = ""

            for event in agent_graph.stream(initial_state, stream_mode="updates"):
                # event = {node_name: state_update}
                print(f"📨 [STREAM EVENT] Received: {list(event.keys())}")

                for node_name, state_update in event.items():
                    print(f"🎯 [NODE COMPLETE] '{node_name}' finished")

                    # Send agent-specific status update
                    agent_status = agent_display_names.get(node_name, f"{node_name} agent working")
                    yield f"data: {json.dumps({'type': 'status', 'content': agent_status + ' ✓'})}\n\n"
                    print(f"✅ [SSE SENT] Status: {agent_status}")

                    # If synthesis agent completed, get final answer
                    if node_name == "synthesis" and "final_answer" in state_update:
                        full_answer = state_update["final_answer"]
                        print(f"🎉 [SYNTHESIS COMPLETE] Final answer length: {len(full_answer)} characters")

            print(f"✅ [AGENT GRAPH] All agents completed. Total answer length: {len(full_answer)} characters")

            save_message(session_id, "user", original_question, None)
            save_message(session_id, "assistant", full_answer, reranked_chunks)

            # Stream answer token by token
            chunk_size = 5
            for i in range(0, len(full_answer), chunk_size):
                chunk = full_answer[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            # Send completion with sources and web results
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
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
