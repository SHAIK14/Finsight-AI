from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.auth import get_current_user
from app.services.supabase_client import supabase

router = APIRouter(
    prefix="/api/chat",
    tags=["chat_history"]
)


class ChatMessage(BaseModel):
    """
    Single message in a chat conversation

    Structure:
    - id: Unique message identifier
    - role: 'user' or 'assistant'
    - content: Message text
    """
    id: int
    role: str
    content: str


class SaveChatRequest(BaseModel):
    """
    Request to save/update a chat session

    Why this structure?
    - id: Frontend generates UUID, backend stores it
    - title: First user message (for sidebar display)
    - messages: Full conversation array
    """
    id: str
    title: str
    messages: List[ChatMessage]


class UpdateTitleRequest(BaseModel):
    """Request to rename a chat session"""
    title: str


@router.post("/save")
async def save_chat(
    request: SaveChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Save or update a chat session (NEW SCHEMA - uses chat_messages table)

    How it works:
    1. Create/update session in chat_sessions
    2. Delete old messages for this session
    3. Insert new messages into chat_messages table
    """
    try:
        # Check if session exists
        existing = supabase.table("chat_sessions").select("id").eq("id", request.id).execute()

        if existing.data:
            # Update existing session title
            supabase.table("chat_sessions").update({
                "title": request.title,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request.id).execute()

            # Delete old messages
            supabase.table("chat_messages").delete().eq("session_id", request.id).execute()
        else:
            # Create new session
            supabase.table("chat_sessions").insert({
                "id": request.id,
                "clerk_id": current_user["clerk_id"],
                "title": request.title
            }).execute()

        # Insert all messages
        for msg in request.messages:
            supabase.table("chat_messages").insert({
                "session_id": request.id,
                "role": msg.role,
                "content": msg.content,
                "sources": None
            }).execute()

        return {
            "success": True,
            "chat_id": request.id
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Chat save error: {str(e)}")
        print(f"📋 Traceback: {error_trace}")
        print(f"🔍 Request ID: {request.id}")
        print(f"🔍 Request title: {request.title}")
        print(f"🔍 Message count: {len(request.messages)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save chat: {str(e)}"
        )


@router.get("/list")
async def list_chats(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all chat sessions for current user (NEW SCHEMA - loads messages from chat_messages)

    Returns sessions with messages array for compatibility with frontend
    """
    try:
        # Get sessions (force fresh data - no cache)
        sessions_response = supabase.table("chat_sessions")\
            .select("*")\
            .eq("clerk_id", current_user["clerk_id"])\
            .order("updated_at", desc=True)\
            .limit(limit)\
            .execute()

        print(f"📋 [CHAT LIST] Found {len(sessions_response.data)} sessions")
        if sessions_response.data:
            latest = sessions_response.data[0]
            print(f"📋 [CHAT LIST] Latest session: {latest['title'][:30]}...")
            print(f"📋 [CHAT LIST] Created: {latest['created_at']}")
            print(f"📋 [CHAT LIST] Updated: {latest['updated_at']}")

        # For each session, load messages
        chats = []
        for session in sessions_response.data:
            messages_response = supabase.table("chat_messages")\
                .select("*")\
                .eq("session_id", session["id"])\
                .order("created_at")\
                .execute()

            # Convert to frontend format
            # For document messages, include documentData from sources
            messages = []
            for idx, msg in enumerate(messages_response.data):
                message_data = {
                    "id": msg["id"],  # Use actual message ID for delete operations
                    "role": msg["role"],
                    "content": msg["content"]
                }
                
                # For document messages, include the document metadata
                if msg["role"] == "document" and msg.get("sources"):
                    message_data["documentData"] = msg["sources"]
                
                messages.append(message_data)

            chats.append({
                "id": session["id"],
                "title": session["title"],
                "messages": messages,
                "created_at": session["created_at"],
                "updated_at": session["updated_at"]
            })

        return {
            "chats": chats
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch chats: {str(e)}"
        )


@router.get("/{chat_id}")
async def get_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get specific chat session by ID (NEW SCHEMA - loads messages from chat_messages)
    """
    try:
        # Get session
        session_response = supabase.table("chat_sessions")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("clerk_id", current_user["clerk_id"])\
            .execute()

        if not session_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found"
            )

        session = session_response.data[0]

        # Get messages
        messages_response = supabase.table("chat_messages")\
            .select("*")\
            .eq("session_id", chat_id)\
            .order("created_at")\
            .execute()

        # Convert to frontend format
        # For document messages, include documentData from sources
        messages = []
        for idx, msg in enumerate(messages_response.data):
            message_data = {
                "id": msg["id"],  # Use actual message ID for delete operations
                "role": msg["role"],
                "content": msg["content"]
            }
            
            # For document messages, include the document metadata
            if msg["role"] == "document" and msg.get("sources"):
                message_data["documentData"] = msg["sources"]
            
            messages.append(message_data)

        return {
            "id": session["id"],
            "title": session["title"],
            "messages": messages,
            "created_at": session["created_at"],
            "updated_at": session["updated_at"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch chat: {str(e)}"
        )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a chat session

    Security:
    - Only owner can delete (clerk_id check)

    Use case:
    - User wants to clean up old chats
    - Context menu in sidebar
    """
    try:
        response = supabase.table("chat_sessions")\
            .delete()\
            .eq("id", chat_id)\
            .eq("clerk_id", current_user["clerk_id"])\
            .execute()

        return {
            "success": True,
            "message": "Chat deleted successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete chat: {str(e)}"
        )


@router.patch("/{chat_id}/title")
async def update_title(
    chat_id: str,
    request: UpdateTitleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Rename a chat session

    Use case:
    - User wants custom title instead of first message
    - Right-click → Rename in sidebar
    """
    try:
        response = supabase.table("chat_sessions")\
            .update({
                "title": request.title,
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", chat_id)\
            .eq("clerk_id", current_user["clerk_id"])\
            .execute()

        return {
            "success": True,
            "title": request.title
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update title: {str(e)}"
        )
