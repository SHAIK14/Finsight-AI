from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.users import router as users_router
from app.api.webhooks import router as webhook_router
from app.api.documents import router as documents_router
from app.api.queries import router as queries_router
from app.api.chat_history import router as chat_history_router
from app.api.chat import router as chat_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-powered financial document analyzer",
    version="0.1.0",
)

# CORS middleware - Permissive for deployment debugging
# Allow common dev/production origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(webhook_router)
app.include_router(documents_router)
app.include_router(queries_router)
app.include_router(chat_history_router)
app.include_router(chat_router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.environment,
    }


@app.get("/")
async def root():
    return {
        "message": "Welcome to FinSight API",
        "docs": "/docs",
    }
