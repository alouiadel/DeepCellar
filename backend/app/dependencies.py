"""Shared FastAPI dependencies."""

from fastapi import HTTPException, Request, status

from app.services import auth as auth_service


def get_current_username(request: Request) -> str:
    token = request.cookies.get(auth_service.COOKIE_NAME)
    username = auth_service.decode_token(token) if token else None
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    return username
