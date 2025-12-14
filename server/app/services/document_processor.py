import io
from typing import List, Dict
from pypdf import PdfReader
import pdfplumber
from fastapi import HTTPException, status
from supabase import Client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import logging

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


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

        # 3. Extract text with page numbers (existing)
        text_pages = extract_text_with_pages(pdf_bytes)

        # 4. Extract tables from PDF (NEW)
        table_data = extract_tables_from_pdf(pdf_bytes)
        logger.info(f"Extracted {len(table_data)} tables from document {document_id}")

        # 5. Chunk text and create table chunks
        all_chunks = chunk_and_embed(text_pages, table_data, document_id)

        # 6. Batch insert
        store_chunks_batch(supabase, all_chunks)

        # 7. Update status
        supabase.table("documents").update({
            "status": "processed"
        }).eq("id", document_id).execute()

        logger.info(f"Document {document_id} processed: {len(all_chunks)} total chunks")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process document {document_id}: {str(e)}")
        # Mark as failed
        supabase.table("documents").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )


def download_pdf(supabase: Client, file_url: str) -> bytes:
    try:
        storage_path = file_url.split("/documents/")[-1]
        return supabase.storage.from_("documents").download(storage_path)
    except Exception as e:
        raise Exception(f"Failed to download PDF: {str(e)}")


def extract_text_with_pages(pdf_bytes: bytes) -> List[Dict[str, any]]:
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


def extract_tables_from_pdf(pdf_bytes: bytes) -> List[Dict]:
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        tables_found = []

        with pdfplumber.open(pdf_file) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract tables from this page
                page_tables = page.extract_tables()

                if page_tables:
                    for table_idx, table_data in enumerate(page_tables):
                        # Filter out empty tables
                        if table_data and len(table_data) > 1:
                            # Skip if table has no actual data (all None/empty)
                            if all(all(cell is None or not str(cell).strip() for cell in row) for row in table_data):
                                continue

                            tables_found.append({
                                "page_number": page_num,
                                "table_index": table_idx,
                                "table_data": table_data,
                                "row_count": len(table_data),
                                "col_count": len(table_data[0]) if table_data else 0
                            })

        logger.info(f"Found {len(tables_found)} tables across all pages")
        return tables_found

    except Exception as e:
        logger.warning(f"Failed to extract tables (continuing with text only): {str(e)}")
        return []  # Return empty list if table extraction fails - fallback to text-only


def table_to_markdown(table_data: List[List[str]], page_number: int, table_index: int) -> str:
    try:
        # Extract header and body
        header = table_data[0] if table_data else []
        body = table_data[1:] if len(table_data) > 1 else []

        # Clean None values and convert to strings
        def clean_cell(cell):
            if cell is None:
                return ""
            return str(cell).strip()

        header = [clean_cell(cell) for cell in header]
        body = [[clean_cell(cell) for cell in row] for row in body]

        # Build markdown table
        markdown_parts = []

        # Add context header
        markdown_parts.append(f"Table from Page {page_number}\n")

        # Header row
        markdown_parts.append("| " + " | ".join(header) + " |")

        # Separator row
        markdown_parts.append("| " + " | ".join(["---"] * len(header)) + " |")

        # Body rows
        for row in body:
            # Ensure row has same length as header (pad if needed)
            while len(row) < len(header):
                row.append("")
            markdown_parts.append("| " + " | ".join(row[:len(header)]) + " |")

        # Add context footer
        markdown_parts.append(f"\nThis table contains structured financial data from page {page_number}.")

        return "\n".join(markdown_parts)

    except Exception as e:
        logger.warning(f"Failed to convert table to markdown: {str(e)}")
        return f"Table from page {page_number} (conversion failed)"


def chunk_and_embed(text_pages: List[Dict], table_data: List[Dict], document_id: str) -> List[Dict]:
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

        # Step 1: Process text pages (existing logic)
        for page in text_pages:
            page_chunks = splitter.split_text(page["text"])

            for chunk_text in page_chunks:
                all_chunks.append({
                    "document_id": document_id,
                    "content": chunk_text,
                    "chunk_index": chunk_index,
                    "page_number": page["page_number"],
                    "element_type": "text",
                    "section_title": None,
                    "metadata": {}
                })
                chunk_index += 1

        logger.info(f"Created {len(all_chunks)} text chunks")

        # Step 2: Process tables (NEW)
        table_chunks_count = 0
        for table in table_data:
            # Convert table to markdown
            markdown_table = table_to_markdown(
                table["table_data"],
                table["page_number"],
                table["table_index"]
            )

            # Create table chunk (tables are NOT split - keep whole)
            all_chunks.append({
                "document_id": document_id,
                "content": markdown_table,
                "chunk_index": chunk_index,
                "page_number": table["page_number"],
                "element_type": "table",  # Tag as table
                "section_title": f"Table {table['table_index']}",
                "metadata": {
                    "table_index": table["table_index"],
                    "row_count": table["row_count"],
                    "col_count": table["col_count"]
                }
            })
            chunk_index += 1
            table_chunks_count += 1

        logger.info(f"Created {table_chunks_count} table chunks")

        # Step 3: Generate embeddings for ALL chunks (text + tables)
        # Extract just the content for embedding
        all_content = [chunk["content"] for chunk in all_chunks]

        # Batch generate embeddings (single API call for all chunks - much faster!)
        logger.info(f"Generating embeddings for {len(all_content)} total chunks...")
        vectors = embeddings_model.embed_documents(all_content)

        # Step 4: Attach embeddings to chunks
        for chunk, vector in zip(all_chunks, vectors):
            chunk["embedding"] = vector

        logger.info(f"Total chunks: {len(all_chunks)} ({len(all_chunks) - table_chunks_count} text + {table_chunks_count} tables)")

        return all_chunks

    except Exception as e:
        raise Exception(f"Failed to chunk and embed: {str(e)}")


def store_chunks_batch(supabase: Client, chunks: List[Dict]):
    try:
        # Supabase allows batch inserts - single DB call instead of N calls
        supabase.table("chunks").insert(chunks).execute()
    except Exception as e:
        raise Exception(f"Failed to store chunks: {str(e)}")
    
    
   

    
    





    

    


