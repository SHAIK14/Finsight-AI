from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "FinSight API"
    debug: bool = False
    environment: str = "development"

    # Clerk Auth
    clerk_secret_key: str
    clerk_webhook_secret: str = ""  # Optional - for webhook signature verification

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # OpenAI
    openai_api_key: str

    # Cohere (for reranking)
    cohere_api_key: str

    # Redis (Upstash)
    upstash_redis_url: str
    upstash_redis_token: str

    # Unstructured.io
    unstructured_api_key: str

    # Tavily (optional - for Pro users)
    tavily_api_key: str = ""

    # Rate limits
    free_upload_limit: int = 1
    free_query_limit: int = 5

    # File size limits (in bytes)
    max_file_size_free: int = 10 * 1024 * 1024       # 10 MB for free users
    max_file_size_premium: int = 50 * 1024 * 1024    # 50 MB for premium/admin

    # Storage quota limits (in bytes)
    max_storage_free: int = 50 * 1024 * 1024         # 50 MB total for free users
    max_storage_premium: int = 500 * 1024 * 1024     # 500 MB total for premium

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
