import io
from typing import List,Dict
from pypdf import PdfReader
from app.core.config import get_settings
from supabase import Client
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

settings = get_settings()

async def process_document(document_id:str, supabase:Client):

    doc = supabase.table("documents").select("*").eq("id", document_id).execute()
    if not doc.data or len(doc.data) == 0:
        raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
    document = doc.data[0]
    file_url = document["file_url"]

    pdf_bytes = download_pdf(supabase,file_url)

    text = extract_text(pdf_bytes)

    chunks = chunk_and_embed(text, document_id)

    store_chunks(supabase,document_id,chunks)

    supabase.table("documents").update({"status":"processed"}).eq("id",document_id).execute()


def download_pdf(supabase:Client,file_url:str) -> bytes:
    storage_path = file_url.split("/documents/")[-1]
    return supabase.storage.from_("documents").download(storage_path)

def extract_text(pdf_bytes:bytes) -> str:
    pdf_file = io.BytesIO(pdf_bytes)
    reader = PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text

def chunk_and_embed(text:str, document_id:str) -> List[Dict]:

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000, 
        chunk_overlap=200, 
        separators=["\n\n", "\n", ". ", " "]
    )
    chunks = splitter.split_text(text)
    
    embeddings_model = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.openai_api_key
    )
    
    vectors = embeddings_model.embed_documents(chunks)
    
    result = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        result.append({
            "content": chunk,
            "embedding": vector,
            "document_id": document_id,
            "chunk_index": i,
            "element_type": "text"  # Type of content (text, table, image, etc.)
        })
    return result

def store_chunks(supabase:Client,document_id:str,chunks:List[Dict]):

    for chunk in chunks:
        supabase.table("chunks").insert({
            "document_id": document_id,
            "content" : chunk["content"],
            "embedding": chunk["embedding"],
            "chunk_index": chunk["chunk_index"],
            "element_type": chunk["element_type"]
        }).execute()
    
    
   

    
    





    

    


