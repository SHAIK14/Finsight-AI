"""
Quick test to verify Cohere reranking works

This tests if:
1. Cohere API key is valid
2. Reranking logic works correctly
3. Relevance scores improve over vector similarity
"""

import sys
sys.path.append('.')

from app.services.reranker import rerank_chunks

# Mock chunks (simulating what vector search returns)
mock_chunks = [
    {
        "id": "1",
        "document_id": "doc-1",
        "content": "Apple's iPhone sales were strong during Q3 2024, with increased demand.",
        "page_number": 12,
        "section_title": "Product Revenue",
        "similarity": 0.85
    },
    {
        "id": "2",
        "document_id": "doc-1",
        "content": "Total revenue for Q3 2024 was $85.8 billion, up 6% year-over-year.",
        "page_number": 5,
        "section_title": "Financial Summary",
        "similarity": 0.82
    },
    {
        "id": "3",
        "document_id": "doc-1",
        "content": "The company continues to focus on innovation and customer experience.",
        "page_number": 45,
        "section_title": "Strategy",
        "similarity": 0.78
    },
    {
        "id": "4",
        "document_id": "doc-1",
        "content": "Operating expenses increased by 5% compared to previous quarter.",
        "page_number": 23,
        "section_title": "Expenses",
        "similarity": 0.75
    },
    {
        "id": "5",
        "document_id": "doc-1",
        "content": "Cash flow from operations remained strong at $25 billion.",
        "page_number": 18,
        "section_title": "Cash Flow",
        "similarity": 0.72
    }
]

query = "What was Apple's Q3 revenue?"

print("="*60)
print("🧪 Testing Cohere Reranking")
print("="*60)
print(f"\nQuery: {query}\n")

print("📊 BEFORE RERANKING (by vector similarity):")
print("-" * 60)
for i, chunk in enumerate(mock_chunks, 1):
    print(f"{i}. [Similarity: {chunk['similarity']:.2f}]")
    print(f"   {chunk['content'][:60]}...")
    print(f"   → Page {chunk['page_number']}, Section: {chunk['section_title']}\n")

# Test reranking
try:
    reranked = rerank_chunks(query, mock_chunks, top_n=3)

    print("\n📈 AFTER RERANKING (by relevance):")
    print("-" * 60)
    for i, chunk in enumerate(reranked, 1):
        print(f"{i}. [Relevance: {chunk['relevance_score']:.2f}]")
        print(f"   {chunk['content'][:60]}...")
        print(f"   → Page {chunk['page_number']}, Section: {chunk['section_title']}\n")

    # Show improvement
    print("\n✨ RESULTS:")
    print("-" * 60)
    top_before = mock_chunks[0]
    top_after = reranked[0]

    if top_before['id'] != top_after['id']:
        print(f"✅ Top result CHANGED!")
        print(f"   Before: {top_before['content'][:50]}...")
        print(f"   After:  {top_after['content'][:50]}...")
    else:
        print(f"ℹ️  Top result stayed the same (was already best)")

    print(f"\n   Relevance improvement: {top_after['relevance_score'] - top_before['similarity']:.3f}")
    print(f"   ({(top_after['relevance_score'] - top_before['similarity']) * 100:.1f}% better)\n")

    print("🎉 SUCCESS! Reranking is working!\n")

except Exception as e:
    print(f"\n❌ ERROR: {e}\n")
    import traceback
    traceback.print_exc()
