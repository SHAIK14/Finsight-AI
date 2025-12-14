from typing import List, Dict, Optional
from uuid import UUID
from app.services.supabase_client import supabase


def create_session(clerk_id: str) -> Dict:
    response = supabase.table("chat_sessions").insert({
        "clerk_id": clerk_id,
        "title": "New Chat"
    }).execute()

    return response.data[0]


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
    response = supabase.table("chat_messages").insert({
        "session_id": session_id,
        "role": role,
        "content": content,
        "sources": sources
    }).execute()

    return response.data[0]


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
