import io
from typing import List, Dict
from pypdf import PdfReader
from fastapi import HTTPException, status
from supabase import Client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

from app.core.config import get_settings

settings = get_settings()


async def process_document(document_id: str, supabase: Client):

    try:
        # 1. Get document
        doc = supabase.table("documents").select("*").eq("id", document_id).single().execute()
        if not doc.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {document_id} not found"
            )
        document = doc.data

        # 2. Download PDF
        pdf_bytes = download_pdf(supabase, document["file_url"])

        # 3. Extract text with page numbers
        pages = extract_text_with_pages(pdf_bytes)

        # 4. Chunk and embed
        chunks = chunk_and_embed(pages, document_id)

        # 5. Batch insert
        store_chunks_batch(supabase, chunks)

        # 6. Update status
        supabase.table("documents").update({
            "status": "processed"
        }).eq("id", document_id).execute()

    except HTTPException:
        raise
    except Exception as e:
        # Mark as failed
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )


def download_pdf(supabase: Client, file_url: str) -> bytes:
    """Download PDF from Supabase Storage"""
    try:
        storage_path = file_url.split("/documents/")[-1]
        return supabase.storage.from_("documents").download(storage_path)
    except Exception as e:
        raise Exception(f"Failed to download PDF: {str(e)}")


def extract_text_with_pages(pdf_bytes: bytes) -> List[Dict[str, any]]:
    """
    Extract text from PDF, preserving page numbers

    Returns: [{"page_number": 1, "text": "..."}, ...]
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_file)

        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if text.strip():  # Skip empty pages
                pages.append({
                    "page_number": i,
                    "text": text
                })

        if not pages:
            raise Exception("No text extracted from PDF")

        return pages
    except Exception as e:
        raise Exception(f"Failed to extract text: {str(e)}")


def chunk_and_embed(pages: List[Dict], document_id: str) -> List[Dict]:
    """
    Chunk text semantically and generate embeddings

    Returns: List of chunks with embeddings and metadata
    """
    try:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

        embeddings_model = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.openai_api_key
        )

        all_chunks = []
        chunk_index = 0

        for page in pages:
            page_chunks = splitter.split_text(page["text"])

            # Generate embeddings for this page's chunks
            vectors = embeddings_model.embed_documents(page_chunks)

            for chunk_text, vector in zip(page_chunks, vectors):
                all_chunks.append({
                    "document_id": document_id,
                    "content": chunk_text,
                    "embedding": vector,
                    "chunk_index": chunk_index,
                    "page_number": page["page_number"],
                    "element_type": "text"
                })
                chunk_index += 1

        return all_chunks
    except Exception as e:
        raise Exception(f"Failed to chunk and embed: {str(e)}")


def store_chunks_batch(supabase: Client, chunks: List[Dict]):
    """Batch insert chunks to database (much faster than one-by-one)"""
    try:
        # Supabase allows batch inserts - single DB call instead of N calls
        supabase.table("chunks").insert(chunks).execute()
    except Exception as e:
        raise Exception(f"Failed to store chunks: {str(e)}")
    
    
   

    
    





    

    


