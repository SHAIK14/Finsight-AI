from fastapi import APIRouter, Request, HTTPException
import hmac
import hashlib
import json

from app.core.config import get_settings
from app.services.user_service import create_user
from app.models.user import UserCreate

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()


@router.post("/clerk")
async def clerk_webhook(request: Request):
    """
    Clerk webhook handler
    
    Triggered when:
    - user.created: New user signs up → Create in our DB
    - user.deleted: User deletes account → Delete from our DB
    """
    
    # Parse JSON
    data = await request.json()
    event_type = data.get("type")
    
    if event_type == "user.created":
        # New user signed up!
        user_data = data.get("data")
        clerk_id = user_data.get("id")
        
        # Get email (Clerk stores in array)
        email_addresses = user_data.get("email_addresses", [])
        email = email_addresses[0].get("email_address") if email_addresses else None
        
        if clerk_id and email:
            # Create user in our database immediately
            await create_user(UserCreate(clerk_id=clerk_id, email=email))
            
            return {"success": True, "message": "User created"}
        
        return {"success": False, "message": "Missing clerk_id or email"}
    
    elif event_type == "user.deleted":
        # User deleted their account
        # TODO: Delete user from our database
        return {"success": True, "message": "User deletion noted"}
    
    return {"success": True, "message": "Event received"}
