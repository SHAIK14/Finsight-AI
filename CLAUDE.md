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

For detailed specs, read from `/.claude/docs/architecture/`:
- `system-overview.md` - Full system design
- `api-endpoints.md` - API routes and schemas
- `database-schema.md` - Tables and relationships
- `frontend-components.md` - UI component structure

## IMPORTANT: Documentation Rules

**All markdown files for Claude context MUST go in `/.claude/docs/`**

```
/.claude/docs/
  /architecture/     # System design, schemas, component specs
  /guides/           # Implementation guides, how-tos
  /decisions/        # Architecture decision records (ADRs)
```

**Never create .md files outside this folder for AI context.**
This folder is gitignored - kept local only.

## User Tiers

- **Free:** 1 PDF/month, 5 queries/month
- **Admin:** Unlimited (role='admin' in DB)
- **Premium:** Unlimited (manual approval)

## Code Documentation Rules

**CRITICAL: ALL code MUST be self-documenting with detailed inline explanations**

When writing functions, ALWAYS include:

1. **Detailed Docstrings** explaining:
   - What the function does
   - How it works (step by step)
   - Why design decisions were made
   - Input/output examples
   - Real-world use cases

2. **Inline Comments** for:
   - Complex logic
   - Non-obvious decisions
   - Important constants or parameters

**Example Format:**

```python
def process_data(input: List[Dict]) -> Dict:
    """
    Process raw data and generate insights

    How it works:
    1. Validate input data
    2. Transform to normalized format
    3. Apply business logic
    4. Generate output

    Why this approach?
    - Validation first prevents bad data propagation
    - Normalization ensures consistent processing
    - Business logic separated for maintainability

    Example:
        Input: [{"user": "john", "amount": 100}, ...]
        Output: {"total": 500, "users": 5, ...}

    Args:
        input: List of transaction dicts

    Returns:
        Aggregated insights dict

    Raises:
        ValueError: If input validation fails
    """
    # Step 1: Validate (prevent bad data early)
    for item in input:
        if "amount" not in item:
            raise ValueError(f"Missing amount in {item}")

    # Step 2: Transform to normalized format
    normalized = [
        {"user": item["user"], "amount": float(item["amount"])}
        for item in input
    ]

    # Continue processing...
```

**Why this matters:**
- Future Claude sessions understand code without context
- Developers (including you) understand decisions months later
- No need for separate documentation files
- Code explains itself

**When to use:**
- ALL service functions
- ALL API endpoints
- Complex business logic
- Non-trivial algorithms
- Database operations
