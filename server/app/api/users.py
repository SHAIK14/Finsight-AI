from fastapi import APIRouter, Depends,HTTPException
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.services.user_service import get_or_create_user
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)) -> User:
    
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


