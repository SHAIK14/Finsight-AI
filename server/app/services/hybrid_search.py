from typing import List, Dict, Optional
from rank_bm25 import BM25Okapi
from app.services.supabase_client import supabase
from app.services.vector_search import embed_question, search_similar_chunks


def tokenize(text: str) -> List[str]:
    return text.lower().split()


def get_document_metadata(document_ids: List[str]) -> Dict[str, Dict]:
    response = supabase.table("documents")\
        .select("id, file_name")\
        .in_("id", document_ids)\
        .execute()
    
    return {doc["id"]: doc for doc in response.data} if response.data else {}


def enrich_chunks_with_metadata(chunks: List[Dict], doc_metadata: Dict[str, Dict]) -> List[Dict]:
    enriched = []
    for chunk in chunks:
        doc = doc_metadata.get(chunk.get("document_id"), {})
        enriched.append({
            **chunk,
            "document_name": doc.get("file_name", "Unknown")
        })
    return enriched


def bm25_search(
    query: str,
    document_ids: List[str],
    top_k: int = 20
) -> List[Dict]:
    response = supabase.table("chunks")\
        .select("id, document_id, content, page_number, section_title")\
        .in_("document_id", document_ids)\
        .execute()
    
    if not response.data:
        return []
    
    chunks = response.data
    corpus = [tokenize(chunk["content"]) for chunk in chunks]
    
    if not corpus or all(len(doc) == 0 for doc in corpus):
        return []
    
    bm25 = BM25Okapi(corpus)
    query_tokens = tokenize(query)
    scores = bm25.get_scores(query_tokens)
    
    scored_chunks = []
    for i, chunk in enumerate(chunks):
        scored_chunks.append({
            **chunk,
            "bm25_score": float(scores[i]),
            "similarity": float(scores[i]) / (max(scores) + 0.001)
        })
    
    scored_chunks.sort(key=lambda x: x["bm25_score"], reverse=True)
    return scored_chunks[:top_k]


def reciprocal_rank_fusion(
    vector_results: List[Dict],
    bm25_results: List[Dict],
    vector_weight: float = 0.5,
    k: int = 60
) -> List[Dict]:
    scores = {}
    chunk_data = {}
    
    for rank, chunk in enumerate(vector_results):
        chunk_id = chunk["id"]
        scores[chunk_id] = scores.get(chunk_id, 0) + vector_weight * (1 / (k + rank + 1))
        chunk_data[chunk_id] = chunk
    
    for rank, chunk in enumerate(bm25_results):
        chunk_id = chunk["id"]
        scores[chunk_id] = scores.get(chunk_id, 0) + (1 - vector_weight) * (1 / (k + rank + 1))
        if chunk_id not in chunk_data:
            chunk_data[chunk_id] = chunk
    
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    
    result = []
    for chunk_id in sorted_ids:
        chunk = chunk_data[chunk_id].copy()
        chunk["rrf_score"] = scores[chunk_id]
        result.append(chunk)
    
    return result


def hybrid_search(
    query: str,
    document_ids: List[str],
    top_k: int = 20,
    vector_weight: float = 0.5
) -> List[Dict]:
    question_embedding = embed_question(query)
    vector_results = search_similar_chunks(
        supabase=supabase,
        question_embedding=question_embedding,
        document_id=document_ids,
        top_k=top_k
    )
    
    bm25_results = bm25_search(query, document_ids, top_k=top_k)
    
    if not vector_results:
        combined = bm25_results[:top_k]
    elif not bm25_results:
        combined = vector_results[:top_k]
    else:
        combined = reciprocal_rank_fusion(
            vector_results,
            bm25_results,
            vector_weight=vector_weight,
            k=60
        )[:top_k]
    
    doc_metadata = get_document_metadata(document_ids)
    return enrich_chunks_with_metadata(combined, doc_metadata)
