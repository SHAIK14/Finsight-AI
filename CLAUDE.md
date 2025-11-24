# FinSight

AI-powered financial document analyzer with multi-agent RAG system. Users upload financial PDFs (10-K, 10-Q, earnings), get instant insights and verified answers.

## Project Structure

```
/FinSight
  /client          # React + Vite (Vercel)
  /server          # FastAPI + Celery (Render)
  /.claude/docs    # Detailed architecture docs (read on-demand)
```

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** FastAPI + Celery
- **Database:** Supabase (PostgreSQL + pgvector)
- **Cache:** Upstash Redis
- **Auth:** Clerk
- **AI:** OpenAI (GPT-4o, GPT-4o-mini, text-embedding-3-large)
- **Doc Processing:** Unstructured.io
- **Web Search:** Tavily (Pro only)

## Key Patterns

- API routes: `/server/app/api/`
- Multi-agent system: `/server/app/agents/`
- Document processing: `/server/app/services/`
- React components: `/client/src/components/`
- React pages: `/client/src/pages/`

## Commands

```bash
# Backend
cd server && uvicorn app.main:app --reload

# Frontend
cd client && npm run dev

# Celery worker
cd server && celery -A app.worker worker --loglevel=info
```

## Architecture Docs

For detailed specs, read from `/.claude/docs/`:
- `system-overview.md` - Full system design
- `api-endpoints.md` - API routes and schemas
- `database-schema.md` - Tables and relationships
- `frontend-components.md` - UI component structure

## User Tiers

- **Free:** 1 PDF/month, 5 queries/month
- **Admin:** Unlimited (role='admin' in DB)
- **Premium:** Unlimited (manual approval)
