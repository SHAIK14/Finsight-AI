from fastapi import APIRouter,Depends,HTTPException,status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List,Optional
import json

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.services.supabase_client import supabase
from app.services.document_processor import process_document
from app.services.vector_search import embed_question,search_similar_chunks
from app.services.llm_service import generate_answer
from app.services.reranker import rerank_chunks
from app.services.query_preprocessor import preprocess_query
from app.services.redis_cache import cache_service
from app.services.query_router import classify_query
from app.services.tavily_search import search_financial_data, format_for_llm
from app.agents.supervisor import agent_graph

router = APIRouter(
    prefix = "/api/queries",
    tags = ["queries"]
)

settings = get_settings() 

class QueryRequest(BaseModel):
    question:str
    document_ids:Optional[List[str]] = None

@router.post("/ask")
async def ask_question(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["clerk_id"]
    question = request.question
    doc_ids = request.document_ids or []

    async def event_generator():
        try:
            if current_user["role"] == "free":
                if current_user["queries_this_month"] >= settings.free_query_limit:
                    yield f"data: {json.dumps({'type': 'error', 'content': 'Query limit reached'})}\n\n"
                    return

            doc_query = supabase.table("documents").select("*").eq("clerk_id", current_user["clerk_id"])
            
            if request.document_ids:
                doc_query = doc_query.in_("id", request.document_ids)

            docs_response = doc_query.execute()

            if not docs_response.data:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No documents found'})}\n\n"
                return

            actual_doc_ids = [doc["id"] for doc in docs_response.data]

            print(f"🔍 Checking cache for question: {question}")
            cached_response = cache_service.get_query_response(user_id, question, actual_doc_ids)
            if cached_response:
                print(f"✅ CACHE HIT - Returning cached response")
                answer_text = cached_response.get('answer', '')
                print(f"📝 Answer length: {len(answer_text)} characters")
                print(f"📝 First 100 chars: {answer_text[:100]}")

                # Stream in chunks of 5 characters for smooth appearance
                chunk_size = 5
                chunk_count = 0
                for i in range(0, len(answer_text), chunk_size):
                    chunk = answer_text[i:i+chunk_size]
                    chunk_count += 1
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

                print(f"📤 Sent {chunk_count} chunks")
                yield f"data: {json.dumps({'type': 'done', 'sources': cached_response.get('sources', [])})}\n\n"
                print(f"✅ Done event sent")
                return

            print(f"❌ CACHE MISS - Running full pipeline")

            for doc in docs_response.data:
                if doc["status"] == "pending":
                    await process_document(doc["id"], supabase)

            route_info = classify_query(request.question, current_user["role"])
            print(f"🧭 Query routed: {route_info}")

            if route_info.get("requires_permission"):
                yield f"data: {json.dumps({'type': 'info', 'content': 'This query requires web search (Pro/Admin feature). Searching documents only...'})}\n\n"
                route_info["needs_web_search"] = False

            normalized_query = preprocess_query(request.question)

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
                    query=request.question,
                    chunks=chunks,
                    top_n=5
                )
                cache_service.set_search_chunks(normalized_query, actual_doc_ids, reranked_chunks)

            web_results = []
            if route_info.get("needs_web_search") and current_user["role"] in ["admin", "premium"]:
                print(f"🌐 Activating web search for: {request.question}")
                web_results = search_financial_data(request.question)
                if web_results:
                    print(f"✅ Added {len(web_results)} web results to context")

            print(f"🤖 Invoking agent graph...")
            initial_state = {
                "messages": [],
                "question": request.question,
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

            chunk_size = 5
            for i in range(0, len(full_answer), chunk_size):
                chunk = full_answer[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'sources': reranked_chunks})}\n\n"

            print(f"💾 Storing in cache: {full_answer[:50]}...")
            cache_service.set_query_response(
                user_id=user_id,
                question=question,
                document_ids=actual_doc_ids,
                response={"answer": full_answer, "sources": reranked_chunks}
            )
            print(f"✅ Cached successfully")
            
            # Update query count after streaming completes
            try:
                supabase.table("users").update({
                    "queries_this_month": current_user["queries_this_month"] + 1
                }).eq("id", current_user["id"]).execute()
            except Exception:
                pass
                
        except Exception as e:
            error_event = {
                "type": "error",
                "content": str(e)
            }
            yield f"data: {json.dumps(error_event)}\n\n"
    
    # Return StreamingResponse with the generator
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
@router.delete("/cache/flush")
async def flush_cache(current_user: dict = Depends(get_current_user)):
    """Flush all cached queries for current user"""
    deleted_count = cache_service.invalidate_query_cache(current_user["clerk_id"])
    return {
        "success": True,
        "message": f"Flushed {deleted_count} cached queries"
    }

@router.get("/history")
async def get_history(
    limit: int = 50,
    current_user:dict = Depends(get_current_user)):
        return {
        "queries": [],
        "message": "Query history not yet implemented"
    }



    
    
        
        
        
        


        


 
