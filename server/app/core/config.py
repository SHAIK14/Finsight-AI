from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "FinSight API"
    debug: bool = False
    environment: str = "development"

    # Clerk Auth
    clerk_secret_key: str

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # OpenAI
    openai_api_key: str

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
