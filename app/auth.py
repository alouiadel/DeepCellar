import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import HTTPException, Request, status
from pwdlib import PasswordHash

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SECRET_KEY_PATH = PROJECT_ROOT / ".secret_key"

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
COOKIE_NAME = "deepcellar_token"

USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,30}$")

_password_hash = PasswordHash.recommended()  # argon2


def _load_or_create_secret_key() -> str:
    """Each installation gets its own random key so the repo contains no secrets."""
    if SECRET_KEY_PATH.exists():
        return SECRET_KEY_PATH.read_text().strip()
    key = secrets.token_hex(32)
    SECRET_KEY_PATH.write_text(key)
    return key


SECRET_KEY = _load_or_create_secret_key()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def get_current_username(request: Request) -> str:
    token = request.cookies.get(COOKIE_NAME)
    username = decode_token(token) if token else None
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    return username
