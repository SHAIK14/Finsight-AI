from supabase import Client, create_client
from datetime import datetime
from typing import Optional

from app.core.config import get_settings
from app.models.user import User, UserCreate

settings = get_settings()

# Create Supabase client
supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key
)

async def get_user_by_clerk_id(clerk_id: str) -> Optional[User]:
    """Get user by Clerk ID"""
    response = supabase.table("users").select("*").eq("clerk_id", clerk_id).excute()
    if response.data and len(response.data) > 0:
        return User(**response.data[0])
    return None
    
async def create_user(user: UserCreate) -> User:
    """Create new user in database"""
    response = supabase.table("users").insert({
        "clerk_id": user_data.clerk_id,
        "email": user_data.email,
        "role": "free",
        "uploads_this_month": 0,
        "queries_this_month": 0,
        "tavily_searches_this_month": 0,
        "usage_reset_date": date.today().isoformat(),
    }).execute()
    
    return User(**response.data[0])


async def get_or_create_user(clerk_id: str, email: str) -> User:
    """
    Get user from database, create if doesn't exist
    
    This is called on every authenticated request:
    1. Check if user exists in our DB
    2. If not, create them (first time signing in)
    3. Return user object
    """
    user = await get_user_by_clerk_id(clerk_id)
    
    if not user:
        user = await create_user(UserCreate(clerk_id=clerk_id, email=email))
    
    return user

async def check_upload_limit(user: User) -> bool:
    """
    Check if user can upload more documents
    
    Returns True if user can upload, False if limit exceeded
    """
    if user.role == "admin":
        return True
    
    if user.role == "premium":
        return True
    
    # Free tier: 1 upload per month
    return user.uploads_this_month < settings.free_upload_limit
async def check_query_limit(user: User) -> bool:
    """Check if user can make more queries"""
    if user.role == "admin":
        return True
    
    if user.role == "premium":
        return True
    
    # Free tier: 5 queries per month
    return user.queries_this_month < settings.free_query_limit


async def check_tavily_limit(user: User) -> bool:
    """Check if user can use Tavily web search"""
    if user.role == "admin":
        return True
    
    if user.role == "premium":
        return True
    
    # Free tier: 2 tavily searches per month
    return user.tavily_searches_this_month < 2


async def increment_upload_count(clerk_id: str):
    """Increment user's upload count"""
    supabase.table("users").update({
        "uploads_this_month": supabase.rpc("increment", {"x": 1}),
        "updated_at": datetime.now().isoformat()
    }).eq("clerk_id", clerk_id).execute()


async def increment_query_count(clerk_id: str):
    """Increment user's query count"""
    supabase.table("users").update({
        "queries_this_month": supabase.rpc("increment", {"x": 1}),
        "updated_at": datetime.now().isoformat()
    }).eq("clerk_id", clerk_id).execute()


async def increment_tavily_count(clerk_id: str):
    """Increment user's Tavily search count"""
    supabase.table("users").update({
        "tavily_searches_this_month": supabase.rpc("increment", {"x": 1}),
        "updated_at": datetime.now().isoformat()
    }).eq("clerk_id", clerk_id).execute()

