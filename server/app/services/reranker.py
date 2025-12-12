import cohere
from app.core.config import get_settings
from typing import List, Dict

# Get settings once at module level (efficient)
settings = get_settings()

def rerank_chunks(query: str, chunks: List[Dict], top_n:int =5) -> List[Dict]:

    if not chunks:
        raise ValueError("cant rerank empty chunks")

    if len(chunks) <= top_n:
        for chunk in chunks:  # Fixed: Use 'chunk' not 'chunks'
            chunk["relevance_score"] = chunk.get("similarity", 0.0)
        return chunks

    client = cohere.Client(api_key=settings.cohere_api_key)

    documents = [chunk["content"] for chunk in chunks]
    try:
        response = client.rerank(
            query = query,
            documents = documents,
            top_n = top_n,
            model = "rerank-english-v3.0",
            return_documents = False
        )
    except Exception as e:
        print(f"Reranking failed: {e}. Using vector search order")
        for chunk in chunks[:top_n]:  # Fixed: Only process top_n chunks
            chunk["relevance_score"] = chunk.get("similarity", 0.0)
        return chunks[:top_n]
    reranked_chunks = []
    for result in response.results:
        chunk = chunks[result.index].copy()
        chunk["relevance_score"] = result.relevance_score
        reranked_chunks.append(chunk)
    return reranked_chunks
    






    
    