from fastapi import APIRouter, Request, HTTPException
import hmac
import hashlib
import json

from app.core.config import get_settings
from app.services.user_service import get_or_create_user, get_user_by_clerk_id
from app.services.supabase_client import supabase
from app.models.user import UserCreate

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()


@router.post("/clerk")
async def clerk_webhook(request: Request):
    """
    Clerk webhook handler

    Triggered when:
    - user.created: New user signs up → Create in our DB
    - user.updated: User updates profile → Update email if changed
    - user.deleted: User deletes account → Delete from our DB

    Note: For production, add Svix signature verification
    """

    # Parse JSON
    data = await request.json()
    event_type = data.get("type")
    user_data = data.get("data", {})
    clerk_id = user_data.get("id")
    
    # Extract email from Clerk's format
    email_addresses = user_data.get("email_addresses", [])
    email = email_addresses[0].get("email_address") if email_addresses else None
    
    if event_type == "user.created":
        # New user signed up - create or update in our DB
        if clerk_id and email:
            await get_or_create_user(clerk_id=clerk_id, email=email)
            return {"success": True, "message": "User created"}
        return {"success": False, "message": "Missing clerk_id or email"}
    
    elif event_type == "user.updated":
        # User updated their profile - update email if we have placeholder
        if clerk_id and email:
            existing_user = await get_user_by_clerk_id(clerk_id)
            if existing_user and existing_user.email.endswith("@pending.finsight.app"):
                # Update the placeholder email with real email
                supabase.table("users").update({
                    "email": email
                }).eq("clerk_id", clerk_id).execute()
                return {"success": True, "message": "User email updated"}
        return {"success": True, "message": "No update needed"}
    
    elif event_type == "user.deleted":
        # User deleted their account
        if clerk_id:
            supabase.table("users").delete().eq("clerk_id", clerk_id).execute()
            return {"success": True, "message": "User deleted"}
        return {"success": True, "message": "User deletion noted"}
    
    return {"success": True, "message": "Event received"}
