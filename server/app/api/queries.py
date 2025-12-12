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

    
    # All the streaming logic goes INSIDE this nested function
    async def event_generator():
        try:
            # Rate limiting check
            if current_user["role"] == "free":
                if current_user["queries_this_month"] >= settings.free_query_limit:
                    yield f"data: {json.dumps({'type': 'error', 'content': 'Query limit reached'})}\n\n"
                    return
            
            # Fetch documents
            doc_query = supabase.table("documents").select("*").eq("clerk_id", current_user["clerk_id"])
            
            if request.document_ids:
                doc_query = doc_query.in_("id", request.document_ids)
            
            docs_response = doc_query.execute()
            
            if not docs_response.data:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No documents found'})}\n\n"
                return
            
            # Lazy process pending documents
            for doc in docs_response.data:
                if doc["status"] == "pending":
                    await process_document(doc["id"], supabase)
            
            # Vector search
            question_embedding = embed_question(request.question)
            doc_ids = [doc["id"] for doc in docs_response.data]
            chunks = search_similar_chunks(
                supabase=supabase,
                question_embedding=question_embedding,
                document_id=doc_ids,
                top_k=5
            )
            
            # Stream answer tokens
            for event in generate_answer(
                question=request.question,
                chunks=chunks,
                stream=True
            ):
                yield f"data: {json.dumps(event)}\n\n"
            
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
@router.get("/history")
async def get_history(
    limit: int = 50,
    current_user:dict = Depends(get_current_user)):
        return {
        "queries": [],
        "message": "Query history not yet implemented"
    }



    
    
        
        
        
        


        


 
