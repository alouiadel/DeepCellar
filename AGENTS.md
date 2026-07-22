# DeepCellar

Login/signup page (HTML/CSS/JS) served by a FastAPI app, with real local
authentication. After login: a chat window that talks to the local Ollama
instance (temporary session with conversational memory), plus a models
dashboard (cloud vs local, thinking models highlighted). Steps towards a
RAG chatbot.

## Structure

- `run_app.py` — entry point: launches uvicorn with `app.main:app`.
- `app/main.py` — FastAPI app factory (`create_app`): includes routers,
  mounts `/static`, initializes the DB.
- `app/config.py` — loads `.env`: `DEFAULT_MODEL_PROVIDER` (`ollama` |
  `ai_grid` | `openai`), `AI_GRID_*` / `OPENAI_*`, `DEFAULT_MODEL_LABEL`,
  `OLLAMA_HOST`.
- `app/dependencies.py` — shared FastAPI deps (`get_current_username`).
- `app/db.py` — SQLite (`deepcellar.db`, gitignored) with a `users` table.
- `app/schemas/` — Pydantic request models (`auth`, `chat`).
- `app/routers/` — HTTP routes by domain:
  - `auth.py` — `/api/signup`, `/api/login`, `/api/logout`, `/api/me`
  - `chat.py` — `POST /api/chat` (streaming NDJSON)
  - `models.py` — `/api/models`, `/api/ollama/models`, `/api/me/config`
  - `pages.py` — `/`, `/app.html`, `/models.html`
- `app/services/` — business logic / clients:
  - `auth.py` — argon2 hashing, JWT sessions, per-install `.secret_key`
  - `llm.py` — provider facade (Ollama vs OpenAI-compatible)
  - `ollama.py` — Ollama `/api/tags` + `/api/chat`
  - `openai.py` — OpenAI-compatible `/models` + `/chat/completions`
    (SSE → Ollama-style NDJSON)
- `pages/` + `static/` — HTML/CSS/JS UI (login, chat, models dashboard).
- `next.md` — roadmap: sessions → RAG → MCP/agents.
- Session: JWT in an HttpOnly, SameSite=Lax cookie (`deepcellar_token`).

Only `static/` is served as static files — keep source code, the DB,
`.secret_key`, and `.env` out of it.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Formatting

Always format code after making changes (installed via Homebrew):

- Python: `ruff check --fix . && ruff format .`
- Web (HTML/CSS/JS): `prettier --write .`

## Running

```bash
.venv/bin/python run_app.py
```

Serves the site at http://127.0.0.1:8000.
