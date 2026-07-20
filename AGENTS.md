# DeepCellar

Login/signup page (HTML/CSS/JS) served by a FastAPI app, with real local
authentication.

## Structure

- `run_app.py` — FastAPI app: API routes (`/api/signup`, `/api/login`,
  `/api/logout`, `/api/me`), serves `index.html` at `/` and the protected
  `app.html` (requires login).
- `auth.py` — argon2 password hashing (`pwdlib`), JWT session tokens (PyJWT),
  per-install secret key generated into `.secret_key` (gitignored, never
  hardcode it).
- `db.py` — SQLite (`deepcellar.db`, gitignored) with a `users` table:
  username (unique), first_name, last_name, password_hash.
- `index.html`, `static/` — public assets (login + signup forms).
- `app.html` — placeholder page shown after login.
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
