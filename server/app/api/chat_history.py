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
    Save or update a chat session

    How it works:
    1. Check if chat exists (by id)
    2. If exists → Update messages and updated_at
    3. If not → Insert new chat

    Why upsert?
    - Frontend can call this after every message
    - No need to track "is this saved yet?"
    - Database handles duplicate prevention

    Example:
        POST /api/chat/save
        {
            "id": "1234567890",
            "title": "What is Hitachi's revenue?",
            "messages": [
                {"id": 1, "role": "user", "content": "..."},
                {"id": 2, "role": "assistant", "content": "..."}
            ]
        }
    """
    try:
        # Convert Pydantic models to dict for JSONB storage
        messages_json = [msg.dict() for msg in request.messages]

        # Check if chat exists
        existing = supabase.table("chat_sessions").select("id").eq("id", request.id).execute()

        if existing.data:
            # Update existing chat
            response = supabase.table("chat_sessions").update({
                "title": request.title,
                "messages": messages_json,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request.id).execute()
        else:
            # Insert new chat
            response = supabase.table("chat_sessions").insert({
                "id": request.id,
                "clerk_id": current_user["clerk_id"],
                "title": request.title,
                "messages": messages_json
            }).execute()

        return {
            "success": True,
            "chat_id": request.id
        }

    except Exception as e:
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
    Get all chat sessions for current user

    How it works:
    1. Fetch chats by clerk_id
    2. Sort by updated_at DESC (most recent first)
    3. Limit results (pagination ready)

    Why this approach?
    - Frontend loads on mount
    - Sorted by activity (like ChatGPT)
    - Can add pagination later (offset + limit)

    Returns:
        {
            "chats": [
                {
                    "id": "1234567890",
                    "title": "What is revenue?",
                    "messages": [...],
                    "created_at": "2024-01-15T10:30:00",
                    "updated_at": "2024-01-15T10:45:00"
                }
            ]
        }
    """
    try:
        response = supabase.table("chat_sessions")\
            .select("*")\
            .eq("clerk_id", current_user["clerk_id"])\
            .order("updated_at", desc=True)\
            .limit(limit)\
            .execute()

        return {
            "chats": response.data
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
    Get specific chat session by ID

    Security:
    - Verify chat belongs to current user (clerk_id check)
    - Prevents users from accessing others' chats

    Use case:
    - Deep linking (share chat URL)
    - Reload specific chat after refresh
    """
    try:
        response = supabase.table("chat_sessions")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("clerk_id", current_user["clerk_id"])\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found"
            )

        return response.data[0]

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
