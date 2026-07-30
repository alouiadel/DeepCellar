import json
from collections.abc import AsyncGenerator

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
from app.avatar import generate_identicon
from app.config import CHAT_COLUMNS, OLLAMA_UNREACHABLE_MSG, PROJECT_ROOT
from app.ollama_client import OllamaUnreachable, list_models, stream_chat

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
    chat_id: int | None = None
    regenerate: bool = False


class RenameChatRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class CreateChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=200)


def _user_id(conn, username: str) -> int:
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return row["id"]


def _get_chat_or_404(conn, chat_id: int, user_id: int) -> dict:
    row = conn.execute(
        f"SELECT {CHAT_COLUMNS} FROM chats WHERE id = ? AND user_id = ?",
        (chat_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
    return row


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
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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


@app.get("/api/avatar/me")
def avatar_me(username: str = Depends(get_current_username)):
    return Response(
        content=generate_identicon(username),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/chats")
def list_chats(username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        rows = conn.execute(
            f"SELECT {CHAT_COLUMNS} FROM chats"
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
            f"SELECT {CHAT_COLUMNS} FROM chats WHERE id = ?",
            (chat_id,),
        ).fetchone()
    return _chat_dict(row)


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: int, username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        row = _get_chat_or_404(conn, chat_id, uid)
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


@app.patch("/api/chats/{chat_id}")
def rename_chat(
    chat_id: int,
    body: RenameChatRequest,
    username: str = Depends(get_current_username),
) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        _get_chat_or_404(conn, chat_id, uid)
        conn.execute(
            "UPDATE chats SET title = ? WHERE id = ?",
            (body.title.strip(), chat_id),
        )
        row = conn.execute(
            f"SELECT {CHAT_COLUMNS} FROM chats WHERE id = ?",
            (chat_id,),
        ).fetchone()
    return _chat_dict(row)


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int, username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        _get_chat_or_404(conn, chat_id, uid)
        conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    return {"ok": True}


@app.get("/api/ollama/models")
def ollama_models(username: str = Depends(get_current_username)) -> dict:
    try:
        return list_models()
    except OllamaUnreachable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            OLLAMA_UNREACHABLE_MSG,
        ) from exc


async def _persisting_stream(
    stream: AsyncGenerator[str, None],
    chat_id: int,
    user_content: str,
    skip_user: bool = False,
    replace_last_assistant: bool = False,
) -> AsyncGenerator[str, None]:
    """Tee the NDJSON stream; on success persist the whole turn atomically.

    The client resends the full history each turn (that resend is the memory),
    so only the trailing user message and the assistant reply are written here.
    """
    content_parts: list[str] = []
    thinking_parts: list[str] = []
    failed = False
    async for line in stream:
        try:
            chunk = json.loads(line)
        except json.JSONDecodeError:
            chunk = {}
        if chunk.get("error"):
            failed = True
        message = chunk.get("message") or {}
        content_parts.append(message.get("content") or "")
        thinking_parts.append(message.get("thinking") or "")
        yield line
    if failed:
        return
    with db.get_connection() as conn:
        if replace_last_assistant:
            last = conn.execute(
                "SELECT id FROM messages WHERE chat_id = ? AND role = 'assistant'"
                " ORDER BY id DESC LIMIT 1",
                (chat_id,),
            ).fetchone()
            if last:
                conn.execute("DELETE FROM messages WHERE id = ?", (last["id"],))
        if not skip_user:
            conn.execute(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, 'user', ?)",
                (chat_id, user_content),
            )
        conn.execute(
            "INSERT INTO messages (chat_id, role, content, thinking)"
            " VALUES (?, 'assistant', ?, ?)",
            (chat_id, "".join(content_parts), "".join(thinking_parts) or None),
        )
        conn.execute(
            "UPDATE chats"
            " SET title = CASE WHEN title = '' THEN ? ELSE title END,"
            " updated_at = datetime('now') WHERE id = ?",
            (user_content.strip().replace("\n", " ")[:40], chat_id),
        )


@app.post("/api/chat")
async def chat(body: ChatRequest, username: str = Depends(get_current_username)):
    messages = [m.model_dump(exclude_none=True) for m in body.messages]
    stream = stream_chat(body.model, messages, body.think)
    with db.get_connection() as conn:
        uid = _user_id(conn, username)
        chat_id = body.chat_id
        if chat_id is None:
            if body.regenerate:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "Cannot regenerate without a chat_id",
                )
            chat_id = conn.execute(
                "INSERT INTO chats (user_id, model) VALUES (?, ?)",
                (uid, body.model),
            ).lastrowid
        else:
            _get_chat_or_404(conn, chat_id, uid)
    if messages[-1]["role"] == "user":
        stream = _persisting_stream(
            stream,
            chat_id,
            messages[-1]["content"],
            skip_user=body.regenerate,
            replace_last_assistant=body.regenerate,
        )
    headers = {"X-Chat-Id": str(chat_id)} if body.chat_id is None else None
    return StreamingResponse(stream, media_type="application/x-ndjson", headers=headers)


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
