from typing import List, Dict
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

from app.core.config import get_settings

settings = get_settings()

# Initialize LLM once (reusable across requests)
llm = ChatOpenAI(
    model="gpt-4o-mini",  # Cheaper than GPT-4 ($0.15/1M vs $5/1M)
    openai_api_key=settings.openai_api_key,
    temperature=0,  # Deterministic (factual, not creative)
)


def generate_answer(question: str, chunks: List[Dict]) -> Dict:
    
    try:
        # Step 1: Build context from chunks
        # Format: [Doc 1, Page 12]\nChunk text\n\n[Doc 2, Page 5]\nChunk text
        context_parts = []
        for i, chunk in enumerate(chunks):
            context_parts.append(
                f"[Document {i+1}, Page {chunk['page_number']}]\n{chunk['content']}"
            )

        context = "\n\n".join(context_parts)

        # Step 2: Create prompt template
        # System message = instructions for GPT
        # User message = the actual question with context
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are a financial document analyst. Answer questions based ONLY on the provided context.

Rules:
- If context doesn't have the info, say "I don't have enough information"
- Don't make up facts
- Cite page numbers when possible

Format your answer:
- Use markdown
- Bullet points for lists
- Include numbers/percentages from the documents
"""),
            ("user", """Context from documents:
{context}

Question: {question}

Answer:""")
        ])

        # Step 3: Create chain (prompt → LLM) and invoke
        # LangChain's | operator chains them together
        chain = prompt_template | llm
        response = chain.invoke({"context": context, "question": question})

        # Step 4: Format sources for frontend
        # Frontend will show these as citations
        sources = []
        for chunk in chunks:
            sources.append({
                "document_id": chunk["document_id"],
                "page_number": chunk["page_number"],
                "content_preview": chunk["content"][:200] + "...",  # First 200 chars
                "similarity": chunk["similarity"]  # How relevant this chunk is
            })

        return {
            "answer": response.content,  # GPT's generated answer
            "sources": sources  # Where the info came from
        }
    except Exception as e:
        raise Exception(f"Failed to generate answer: {str(e)}")

