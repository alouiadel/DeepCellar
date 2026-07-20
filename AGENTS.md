# DeepCellar

Login/signup page (HTML/CSS/JS) served by a FastAPI app, with real local
authentication. After login: a chat window that talks to the local Ollama
instance (temporary session with conversational memory), plus a models
dashboard (cloud vs local, thinking models highlighted). Steps towards a
RAG chatbot.

## Structure

- `run_app.py` — FastAPI app: API routes (`/api/signup`, `/api/login`,
  `/api/logout`, `/api/me`, `/api/ollama/models`, `POST /api/chat`
  streaming NDJSON), serves `index.html` at `/` and the protected
  `app.html` (chat) / `models.html` (dashboard).
- `auth.py` — argon2 password hashing (`pwdlib`), JWT session tokens (PyJWT),
  per-install secret key generated into `.secret_key` (gitignored, never
  hardcode it).
- `db.py` — SQLite (`deepcellar.db`, gitignored) with a `users` table:
  username (unique), first_name, last_name, password_hash.
- `ollama_client.py` — talks to the Ollama server (`OLLAMA_HOST` env var,
  default `http://localhost:11434`). `/api/tags` provides everything:
  cloud models are identified by `remote_host`, thinking models by
  `"thinking"` in `capabilities` (falls back to `/api/show` on older
  Ollama versions). `stream_chat` proxies `/api/chat`; on failure it
  yields a final `{"done": true, "error": ...}` line instead of raising.
- `index.html`, `static/` — public assets (login + signup forms).
- `app.html` + `static/app.js` — chat window: model picker (thinking models
  marked ✦, `think: true` sent for them), message history kept client-side
  and resent each turn (Ollama's `/api/chat` is stateless — that resend IS
  the memory). Assistant replies render as markdown via vendored
  `marked` + `DOMPurify` (`static/vendor/`, pinned, offline-friendly,
  prettier-ignored — see `.prettierignore`). Temporary session: switching
  models or reloading resets it.
- `models.html` + `static/models.js` — models dashboard; asks the user to
  start Ollama (`ollama serve`) when it is unreachable (503 from the API).
- Session: JWT in an HttpOnly, SameSite=Lax cookie (`deepcellar_token`).

Only `static/` is served as static files — keep source code, the DB and
`.secret_key` out of it.

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
