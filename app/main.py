from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import db
from app.auth import (
    COOKIE_NAME,
    TOKEN_EXPIRE_HOURS,
    USERNAME_RE,
    create_token,
    get_current_username,
    hash_password,
    verify_password,
)
from app.ollama_client import OllamaUnreachable, list_models, stream_chat

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = PROJECT_ROOT / "pages"

app = FastAPI(title="DeepCellar")
db.init_db()


class SignupRequest(BaseModel):
    username: str
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(max_length=100_000)
    thinking: str | None = Field(default=None, max_length=100_000)


class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=200)
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    think: bool = False


class CreateChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=200)


def _user_id(conn, username: str) -> int:
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return row["id"]


def _chat_dict(row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "model": row["model"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@app.post("/api/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest) -> dict:
    if not USERNAME_RE.fullmatch(body.username):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Username must be 3-30 characters: letters, digits, _ or -",
        )
    with db.get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
        conn.execute(
            "INSERT INTO users (username, first_name, last_name, password_hash)"
            " VALUES (?, ?, ?, ?)",
            (
                body.username,
                body.first_name.strip(),
                body.last_name.strip(),
                hash_password(body.password),
            ),
        )
    return {"username": body.username}


@app.post("/api/login")
def login(body: LoginRequest, response: Response) -> dict:
    with db.get_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid username or password"
        )
    response.set_cookie(
        COOKIE_NAME,
        create_token(user["username"]),
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        httponly=True,
        samesite="lax",
    )
    return {"username": user["username"], "first_name": user["first_name"]}


@app.post("/api/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/me")
def me(username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        user = conn.execute(
            "SELECT username, first_name, last_name FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return dict(user)


@app.get("/api/chats")
def list_chats(username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        rows = conn.execute(
            "SELECT id, title, model, created_at, updated_at FROM chats"
            " WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (uid,),
        ).fetchall()
    return {"chats": [_chat_dict(r) for r in rows]}


@app.post("/api/chats", status_code=status.HTTP_201_CREATED)
def create_chat(
    body: CreateChatRequest, username: str = Depends(get_current_username)
) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        cur = conn.execute(
            "INSERT INTO chats (user_id, model) VALUES (?, ?)",
            (uid, body.model),
        )
        chat_id = cur.lastrowid
        row = conn.execute(
            "SELECT id, title, model, created_at, updated_at FROM chats WHERE id = ?",
            (chat_id,),
        ).fetchone()
    return _chat_dict(row)


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: int, username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        row = conn.execute(
            "SELECT id, title, model, created_at, updated_at FROM chats"
            " WHERE id = ? AND user_id = ?",
            (chat_id, uid),
        ).fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
        messages = conn.execute(
            "SELECT role, content, thinking, created_at FROM messages"
            " WHERE chat_id = ? ORDER BY id ASC",
            (chat_id,),
        ).fetchall()
    return {
        **_chat_dict(row),
        "messages": [
            {
                "role": m["role"],
                "content": m["content"],
                "thinking": m["thinking"],
                "created_at": m["created_at"],
            }
            for m in messages
        ],
    }


@app.get("/api/ollama/models")
def ollama_models(username: str = Depends(get_current_username)) -> dict:
    try:
        return list_models()
    except OllamaUnreachable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Ollama is not reachable. Start it with `ollama serve` or open the Ollama app.",
        ) from exc


@app.post("/api/chat")
async def chat(body: ChatRequest, username: str = Depends(get_current_username)):
    messages = [m.model_dump(exclude_none=True) for m in body.messages]
    stream = stream_chat(body.model, messages, body.think)
    return StreamingResponse(stream, media_type="application/x-ndjson")


@app.get("/models.html", include_in_schema=False)
def models_page(username: str = Depends(get_current_username)) -> FileResponse:
    return FileResponse(PAGES_DIR / "models.html")


@app.get("/app.html", include_in_schema=False)
def app_page(username: str = Depends(get_current_username)) -> FileResponse:
    return FileResponse(PAGES_DIR / "app.html")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(PAGES_DIR / "index.html")


# Only the static/ directory is publicly served (CSS/JS) — source code,
# the database and the secret key stay private.
app.mount("/static", StaticFiles(directory=PROJECT_ROOT / "static"), name="static")
