from fastapi import APIRouter, Depends,HTTPException
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.core.config import get_settings
from app.services.user_service import get_or_create_user
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])
settings = get_settings()

@router.get("/me")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Get current user profile with usage stats and limits

    Returns:
    - User info (clerk_id, email, role)
    - Current month usage (uploads, queries)
    - Limits based on role (null = unlimited for admin/premium)
    """
    user = await get_or_create_user(
        clerk_id=current_user["clerk_id"],
        email=current_user["email"]
    )

   
    if user.role == "admin":
        uploads_limit = None  
        queries_limit = None  
    elif user.role == "premium":
        uploads_limit = None  
        queries_limit = None  
    else:  # free
        uploads_limit = settings.free_upload_limit
        queries_limit = settings.free_query_limit

    return {
        "clerk_id": user.clerk_id,
        "email": user.email,
        "role": user.role,
        "uploads_this_month": user.uploads_this_month,
        "uploads_limit": uploads_limit,
        "queries_this_month": user.queries_this_month,
        "queries_limit": queries_limit,
        "tavily_searches_this_month": user.tavily_searches_this_month,
        "usage_reset_date": user.usage_reset_date
    }

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)) -> User:
    """Legacy endpoint - use /me instead"""
    user = await get_or_create_user(
        clerk_id=current_user["clerk_id"],
        email=current_user["email"]
    )
    return user

class PremiumRequest(BaseModel):
    reason : str

@router.post("/request-premium")
async def request_premium(
    request: PremiumRequest,
    current_user: dict = Depends(get_current_user)
):
    user = await get_or_create_user(
        clerk_id=current_user["clerk_id"],
        email=current_user["email"]
    )
    return{
        "message": "Premium request submitted successfully",
        "user_email": user.email,
        "reason": request.reason
    }


