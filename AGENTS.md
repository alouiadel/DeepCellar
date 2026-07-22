# DeepCellar

Local-first AI chat app (FastAPI + React). Auth, streaming chat via Ollama
or OpenAI-compatible providers (AI Grid), models dashboard. Foundation for
an upcoming RAG chatbot.

## Structure

- `run_app.py` — entry point: launches uvicorn with `app.main:app`.
- `app/main.py` — FastAPI app factory (`create_app`): API routers + SPA.
- `app/config.py` — `.env` settings (provider, keys, `DATA_DIR`, …).
- `app/dependencies.py` — shared FastAPI deps (`get_current_username`).
- `app/db.py` — SQLite (local) or PostgreSQL (`DATABASE_URL`).
- `app/schemas/` — Pydantic request models (`auth`, `chat`).
- `app/routers/` — `auth`, `chat`, `models`, `pages` (SPA entry).
- `app/services/` — `auth`, `llm`, `ollama`, `openai`.
- `frontend/` — modular React (JS) + Redux + Tailwind + shadcn/ui:
  - `src/app/` — providers, router, store
  - `src/features/{auth,chat,models}/`
  - `src/shared/` — api, layout, ui, lib
- `backend/Dockerfile` + `frontend/Dockerfile` + `docker-compose.yml` —
  services: `frontend` (nginx), `backend` (FastAPI), `db` (Postgres).
- `next.md` — roadmap: sessions → RAG → MCP/agents.
- Session: JWT HttpOnly cookie (`deepcellar_token`).

Only SPA/nginx + API are exposed — keep source, credentials, `.secret_key`,
and `.env` private.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd frontend && npm install
```

## Formatting

- Python: `ruff check --fix . && ruff format .`
- Web: `prettier --write frontend/src`

## Running

```bash
# API
.venv/bin/python -c "import uvicorn; uvicorn.run('run_app:app', host='127.0.0.1', port=8001, reload=True)"

# UI (dev)
cd frontend && npm run dev
```

Or: `docker compose up --build`
