from fastapi import HTTPException,Security
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from functools import lru_cache

from app.core.config import get_settings
from app.models.user import User
from app.services.supabase_client import supabase

settings = get_settings()
security = HTTPBearer()

def get_clerk_jwks():
    """Fetch Clerk's public keys for JWT verification (cached)"""
    # Extract Clerk frontend API from publishable key or use direct domain
    # For development, use your Clerk instance domain
    clerk_domain = "sacred-muskox-58.clerk.accounts.dev"
    response = httpx.get(f"https://{clerk_domain}/.well-known/jwks.json")
    response.raise_for_status()
    return response.json()
    
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Verify Clerk JWT token and return user info
    
    Flow:
    1. Extract token from Authorization header
    2. Verify token signature with Clerk's public keys
    3. Extract user data from token payload
    4. Return user info (clerk_id, email)
    """
    token = credentials.credentials
    
    try:
        # Decode JWT without verification first to get header
        unverified_header = jwt.get_unverified_header(token)
        
        # Get Clerk's public keys
        jwks = get_clerk_jwks()
        
        # Find the key that matches the token
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find appropriate key")
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False}  # Clerk doesn't use audience claim
        )
        
        # Extract user info from payload
        # Clerk stores user ID in "sub" claim
        clerk_id = payload.get("sub")
        
        # Email might be in different places depending on sign-up method
        email = payload.get("email")
        if not email:
            email = payload.get("primary_email_address")
        if not email and payload.get("email_addresses"):
            email_list = payload.get("email_addresses", [])
            if email_list and len(email_list) > 0:
                email = email_list[0].get("email_address")

        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Use user_service to get or create user (auto-creates on first login)
        from app.services.user_service import get_or_create_user

        user = await get_or_create_user(clerk_id=clerk_id, email=email)

        # Return dict with user data (not User object, for compatibility)
        return {
            "id": str(user.id),
            "clerk_id": user.clerk_id,
            "email": user.email,
            "role": user.role,
            "uploads_this_month": user.uploads_this_month,
            "queries_this_month": user.queries_this_month,
        }

        
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
