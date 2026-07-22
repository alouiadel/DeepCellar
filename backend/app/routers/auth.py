from fastapi import APIRouter, Depends, HTTPException, Response, status

from app import db
from app.dependencies import get_current_username
from app.schemas.auth import LoginRequest, SignupRequest
from app.services import auth as auth_service

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest) -> dict:
    if not auth_service.USERNAME_RE.fullmatch(body.username):
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
                auth_service.hash_password(body.password),
            ),
        )
    return {"username": body.username}


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict:
    with db.get_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    if not user or not auth_service.verify_password(
        body.password, user["password_hash"]
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid username or password"
        )
    response.set_cookie(
        auth_service.COOKIE_NAME,
        auth_service.create_token(user["username"]),
        max_age=auth_service.TOKEN_EXPIRE_HOURS * 3600,
        httponly=True,
        samesite="lax",
    )
    return {"username": user["username"], "first_name": user["first_name"]}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(auth_service.COOKIE_NAME)
    return {"ok": True}


@router.get("/me")
def me(username: str = Depends(get_current_username)) -> dict:
    with db.get_connection() as conn:
        user = conn.execute(
            "SELECT username, first_name, last_name FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return dict(user)
