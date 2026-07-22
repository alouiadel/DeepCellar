# DeepCellar

Local-first AI chat app (FastAPI + React). Auth, streaming chat via Ollama
or OpenAI-compatible providers (AI Grid), models dashboard. Foundation for
an upcoming RAG chatbot.

## Structure

- `backend/` — FastAPI API
  - `run_app.py` — uvicorn entry (`run_app:app`)
  - `app/` — config, db, routers, schemas, services
  - `Dockerfile` — API image (Compose context: `./backend`)
- `frontend/` — modular React (JS) + Redux + Tailwind + shadcn/ui
  - `src/app/` — providers, router, store
  - `src/features/{auth,chat,models}/`
  - `src/shared/` — api, layout, ui, lib
  - `Dockerfile` + `nginx.conf`
- `docker-compose.yml` — `frontend`, `backend`, `db` (Postgres)
- `next.md` — roadmap: sessions → RAG → MCP/agents
- Session: JWT HttpOnly cookie (`deepcellar_token`)

Only SPA/nginx + API are exposed — keep source, credentials, `.secret_key`,
and `.env` private.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install
```

## Formatting

- Python: `ruff check --fix backend && ruff format backend`
- Web: `prettier --write frontend/src`

## Running

```bash
# API (from backend/)
cd backend
../.venv/bin/python -c "import uvicorn; uvicorn.run('run_app:app', host='127.0.0.1', port=8001, reload=True)"

# UI (dev)
cd frontend && npm run dev
```

Or: `docker compose up --build`
