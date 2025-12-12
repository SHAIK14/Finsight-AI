from typing import List, Dict,Optional
from langchain_openai import OpenAIEmbeddings
from supabase import Client

from app.core.config import get_settings

settings = get_settings()


def embed_question(question:str) -> list[float]:
    try:
        embedding_model = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.openai_api_key
        )
        return embedding_model.embed_query(question)
    except Exception as e:
        raise Exception(f"Failed to embed question: {str(e)}")


def search_similar_chunks(supabase:Client,question_embedding: List[float],
 document_id:Optional[List[str]]=None,
 top_k:int=5):

 try:
    params = {
        "query_embedding": question_embedding,
        "match_count": top_k
    }
    if document_id:
        params["filter_document_ids"] = document_id
    
    response = supabase.rpc("match_chunks", params).execute()
    return response.data
 except Exception as e:
    raise Exception(f"Failed to search similar chunks: {str(e)}")









