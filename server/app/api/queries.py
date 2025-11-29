from fastapi import APIRouter,Depends,HTTPException,status
from pydantic import BaseModel
from typing import List,Optional

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
    request:QueryRequest,
    current_user:dict = Depends(get_current_user)):
    try:

        if current_user["role"] == "free":
            if current_user["queries_this_month"] >= settings.free_query_limit:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Free users have reached their query limit for this month"
                )
        
        doc_query = supabase.table("documents").select("*").eq("clerk_id",current_user["clerk_id"])

        if request.document_ids:
            doc_query = doc_query.in_("id",request.document_ids)

        docs_response = doc_query.execute()

        if not docs_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No documents found, please upload the document"
            )

        for doc in docs_response.data:
            if doc["status"] == "pending":
                await process_document(doc["id"],supabase)


        question_embedding = embed_question(request.question) 
        doc_ids = [doc["id"] for doc in docs_response.data]
        chunks = search_similar_chunks(
            supabase=supabase,
            question_embedding =question_embedding,
            document_ids = doc_ids,
            top_k=5
            )
        result = generate_answer(
            question=request.question,
            chunks=chunks
        )
        try : 
            supabase.table("users").update({
                "queries_this_month":current_user["queries_this_month"] + 1
            }).eq("id",current_user["id"]).execute()
        except Exception:
            pass
        return {
            "answer" : result["answer"],
            "sources" : result["sources"],
            "cached": False
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
@router.get("/history")
async def get_history(
    limit: int = 50,
    current_user:dict = Depends(get_current_user)):
        return {
        "queries": [],
        "message": "Query history not yet implemented"
    }



    
    
        
        
        
        


        


 
