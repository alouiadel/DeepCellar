"""Serve the React SPA (Vite build in frontend/dist)."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from app.config import REPO_ROOT

SPA_DIR = REPO_ROOT / "frontend" / "dist"

router = APIRouter(tags=["pages"], include_in_schema=False)


def _spa_index() -> Path:
    index = SPA_DIR / "index.html"
    if index.is_file():
        return index
    raise HTTPException(
        404,
        "Frontend not built. Run: cd frontend && npm run build",
    )


@router.get("/")
def index() -> FileResponse:
    return FileResponse(_spa_index())


@router.get("/login")
@router.get("/chat")
@router.get("/models")
def spa_routes() -> FileResponse:
    return FileResponse(_spa_index())


# Old vanilla URLs → React routes
@router.get("/app.html")
def legacy_app() -> RedirectResponse:
    return RedirectResponse("/chat", status_code=301)


@router.get("/models.html")
def legacy_models() -> RedirectResponse:
    return RedirectResponse("/models", status_code=301)
