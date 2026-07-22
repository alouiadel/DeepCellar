# DeepCellar

A local-first AI chat app that talks to your own
[Ollama](https://ollama.com) instance — local and cloud models, thinking
support, and real authentication, all wrapped in a dark purple UI.
DeepCellar is the foundation for an upcoming RAG chatbot: the chat, model
management, and auth layers are already in place.

![DeepCellar login](docs/screenshot-login.png)

## Features

**Chat**

- Streams replies from Ollama's native `/api/chat` endpoint through a
  FastAPI proxy (NDJSON)
- Conversational memory within a temporary session — the full message
  history is resent each turn (Ollama's chat API is stateless by design)
- Thinking models (detected natively via `capabilities`) get `think: true`
  automatically, with their reasoning shown in a collapsible block
- Assistant replies rendered as markdown (bold, lists, code blocks, tables)
  via vendored `marked` + `DOMPurify` — works fully offline
- Unified composer: message box, custom model dropdown, and send button in
  one smooth container

**Models**

- Model picker groups Cloud vs Local models and only lists chat-capable
  ones (native `"completion"` capability — embedding-only models are
  excluded)
- Models dashboard with per-model details: parameters, quantization,
  family, context length, size, host
- Thinking models are highlighted; non-chatable models get a distinct
  "not chatable" badge
- Detects when Ollama isn't running and tells you how to start it

**Accounts & security**

- Real local accounts: username + password signup/login, argon2 password
  hashing, SQLite storage
- JWT sessions in an HttpOnly, SameSite=Lax cookie
- Per-install secret key generated on first run — nothing sensitive is
  ever committed to the repo
- Only the React SPA build is served publicly; source code, the database,
  and the secret key are never exposed over HTTP

## Requirements

- Python 3.11+
- Either:
  - [Ollama](https://ollama.com) running (`ollama serve` / desktop app), or
  - An OpenAI-compatible provider (e.g. AI Grid) configured in `.env`

## Quick start

```bash
git clone https://github.com/alouiadel/DeepCellar.git
cd DeepCellar

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env   # set DEFAULT_MODEL_PROVIDER + API key for AI Grid
# or leave provider as ollama and start Ollama

# API (port 8001 if 8000 is busy)
.venv/bin/python -c "import uvicorn; uvicorn.run('run_app:app', host='127.0.0.1', port=8001, reload=True)"
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to the FastAPI backend.

Production UI build (optional; FastAPI serves `frontend/dist`):

```bash
cd frontend && npm run build
```

### Docker Compose (frontend + backend + Postgres)

```bash
cp .env.example .env   # set AI_GRID_API_KEY, passwords, etc.
docker compose up --build -d
```

| Service | URL / port | Role |
|---------|------------|------|
| **frontend** | http://127.0.0.1:8080 | Nginx + React SPA (proxies `/api`) |
| **backend** | http://127.0.0.1:8000 | FastAPI API |
| **db** | localhost:5432 | PostgreSQL 16 |

```bash
docker compose logs -f frontend backend db
docker compose down
```


## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `DEFAULT_MODEL_PROVIDER` | `ollama` | `ollama`, `ai_grid`, or `openai` |
| `DEFAULT_MODEL_LABEL` | `google/gemma-4-31B` | Preferred model id (OpenAI-compatible) |
| `AI_GRID_API_KEY` | _(empty)_ | Bearer token for AI Grid / OpenAI-compatible API |
| `AI_GRID_BASE_URL` | `http://app.ai-grid.io:4000/v1` | OpenAI-compatible base URL (`…/v1`) |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | aliases | Same as `AI_GRID_*` when using OpenAI gateways |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server (when provider is `ollama`) |

Example AI Grid `.env`:

```bash
DEFAULT_MODEL_PROVIDER=ai_grid
AI_GRID_API_KEY=sk-…
AI_GRID_BASE_URL=http://app.ai-grid.io:4000/v1
DEFAULT_MODEL_LABEL=google/gemma-4-31B
```

## Project structure

```
DeepCellar/
├── run_app.py
├── .env.example
├── app/
│   ├── main.py              App factory (API routers + SPA)
│   ├── config.py            Env / `.env` settings
│   ├── db.py                SQLite users table
│   ├── dependencies.py      Shared FastAPI deps (auth)
│   ├── routers/
│   │   ├── auth.py
│   │   ├── chat.py
│   │   ├── models.py
│   │   └── pages.py         SPA HTML entry routes
│   ├── schemas/
│   └── services/
├── backend/Dockerfile       FastAPI API image (context: repo root)
├── frontend/Dockerfile      Nginx + React image (context: frontend/)
├── frontend/nginx.conf      SPA reverse-proxy to API
├── docker-compose.yml       frontend + backend + Postgres
├── frontend/                Modular React app
│   ├── src/
│   │   ├── app/             Providers, router, Redux store
│   │   ├── features/        auth / chat / models
│   │   └── shared/          api, layout, ui (shadcn), lib
│   └── dist/                `npm run build` output (gitignored)
└── docs/
```
Files created at runtime (gitignored): `deepcellar.db`, `.secret_key`, `.env`.

## How it works

- **Auth** — passwords are hashed with argon2 (`pwdlib`) and stored in a
  local SQLite database. Logging in issues a signed JWT stored in an
  HttpOnly cookie; protected pages and API routes verify it.
- **Providers** — `DEFAULT_MODEL_PROVIDER` selects Ollama or an
  OpenAI-compatible gateway (AI Grid). Chat streams are always exposed to
  the UI as Ollama-style NDJSON.
- **Model detection** — Ollama uses `/api/tags`; OpenAI-compatible uses
  `GET /v1/models`. Embedding/OCR-like ids are marked non-chatable.
- **Chat memory** — the browser keeps the conversation and resends it with
  every message. Reloading or switching models starts a fresh temporary session.

## Roadmap

- RAG: document ingestion, embeddings, retrieval-augmented chats
- Persistent and multiple chat sessions
- Per-user preferences

## Development

Formatting (installed via Homebrew):

```bash
ruff check --fix . && ruff format .   # Python
prettier --write .                    # HTML / CSS / JS
```

## License

MIT — see [LICENSE](LICENSE).
