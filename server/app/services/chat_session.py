from typing import List, Dict, Optional
from uuid import UUID
from app.services.supabase_client import supabase


def create_session(clerk_id: str) -> Dict:
    """
    Create a new chat session for a user
    
    Returns:
        Dict with session id, clerk_id, title, created_at, updated_at
    """
    response = supabase.table("chat_sessions").insert({
        "clerk_id": clerk_id,
        "title": "New Chat"
    }).execute()

    return response.data[0]


def ensure_session(clerk_id: str, session_id: Optional[str] = None) -> Dict:
    """
    Ensure a session exists - create if needed, return existing if found
    
    Why this function?
    - When uploading a document, we need a session to attach it to
    - If no session_id provided, create a new one
    - If session_id provided but doesn't exist, create with that ID
    
    Args:
        clerk_id: User's Clerk ID
        session_id: Optional session ID to check/use
        
    Returns:
        Session dict with id, clerk_id, title, etc.
    """
    if session_id:
        # Check if session exists
        existing = supabase.table("chat_sessions")\
            .select("*")\
            .eq("id", session_id)\
            .eq("clerk_id", clerk_id)\
            .execute()
        
        if existing.data:
            return existing.data[0]
    
    # Create new session
    return create_session(clerk_id)


def get_session(session_id: str) -> Optional[Dict]:
    response = supabase.table("chat_sessions")\
        .select("*")\
        .eq("id", session_id)\
        .single()\
        .execute()

    return response.data if response.data else None


def get_user_sessions(clerk_id: str, limit: int = 50) -> List[Dict]:
    response = supabase.table("chat_sessions")\
        .select("*")\
        .eq("clerk_id", clerk_id)\
        .order("updated_at", desc=True)\
        .limit(limit)\
        .execute()

    return response.data


def get_session_messages(session_id: str, limit: int = 50) -> List[Dict]:
    response = supabase.table("chat_messages")\
        .select("*")\
        .eq("session_id", session_id)\
        .order("created_at")\
        .limit(limit)\
        .execute()

    return response.data


def save_message(
    session_id: str,
    role: str,
    content: str,
    sources: Optional[List[Dict]] = None
) -> Dict:
    """
    Save a message to a chat session
    
    Roles supported:
    - "user": User's question
    - "assistant": AI's response  
    - "document": Document upload notification
    
    For document role:
    - content: Document filename (for display)
    - sources: Document metadata {document_id, fileName, fileSize, status, fileUrl}
    """
    response = supabase.table("chat_messages").insert({
        "session_id": session_id,
        "role": role,
        "content": content,
        "sources": sources
    }).execute()

    return response.data[0]


def save_document_message(
    session_id: str,
    document_id: str,
    file_name: str,
    file_size: str,
    file_url: str,
    status: str = "pending"
) -> Dict:
    """
    Save a document upload message to a chat session
    
    How it works:
    1. Creates a message with role="document"
    2. Stores document metadata in sources field
    3. Content is the filename for easy access
    
    Why store in sources?
    - sources field already exists as JSONB
    - Keeps schema changes minimal
    - Frontend can extract document info easily
    
    Example output:
    {
        "id": "uuid",
        "session_id": "session-uuid",
        "role": "document",
        "content": "Tesla_10K_2024.pdf",
        "sources": {
            "document_id": "doc-uuid",
            "fileName": "Tesla_10K_2024.pdf",
            "fileSize": "2.45 MB",
            "fileUrl": "https://...",
            "status": "pending"
        }
    }
    """
    document_metadata = {
        "document_id": document_id,
        "fileName": file_name,
        "fileSize": file_size,
        "fileUrl": file_url,
        "status": status
    }
    
    response = supabase.table("chat_messages").insert({
        "session_id": session_id,
        "role": "document",
        "content": file_name,
        "sources": document_metadata
    }).execute()

    return response.data[0]


def delete_document_message(session_id: str, document_id: str) -> bool:
    """
    Delete a document message from a chat session
    
    How it works:
    1. Find message with role="document" and matching document_id in sources
    2. Delete that message
    
    Why needed?
    - When user deletes document from chat, remove the message
    - Document in documents table is deleted separately
    
    Returns:
        True if message was deleted, False if not found
    """
    # Get all document messages for this session
    messages = supabase.table("chat_messages")\
        .select("*")\
        .eq("session_id", session_id)\
        .eq("role", "document")\
        .execute()
    
    # Find the one with matching document_id
    for msg in messages.data:
        if msg.get("sources") and msg["sources"].get("document_id") == document_id:
            supabase.table("chat_messages")\
                .delete()\
                .eq("id", msg["id"])\
                .execute()
            return True
    
    return False


def delete_session(session_id: str) -> bool:
    response = supabase.table("chat_sessions")\
        .delete()\
        .eq("id", session_id)\
        .execute()

    return len(response.data) > 0


def format_conversation_history(messages: List[Dict], max_turns: int = 5) -> str:
    recent_messages = messages[-(max_turns * 2):]

    formatted = []
    for msg in recent_messages:
        formatted.append(f"{msg['role'].capitalize()}: {msg['content']}")

    return "\n".join(formatted)
