from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class User(BaseModel):
    id: str
    clerk_id: str
    email: str
    role: str = "free"
    uploads_this_month: int = 0
    queries_this_month: int = 0
    tavily_searches_this_month: int = 0
    usage_reset_date: datetime
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
    
class UserCreate(BaseModel):
    clerk_id: str
    email: str