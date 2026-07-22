"""FastAPI application factory."""

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import db
from app.config import REPO_ROOT
from app.routers import auth, chat, models, pages

SPA_DIR = REPO_ROOT / "frontend" / "dist"


def create_app() -> FastAPI:
    application = FastAPI(title="DeepCellar")
    db.init_db()

    application.include_router(auth.router)
    application.include_router(chat.router)
    application.include_router(models.router)
    application.include_router(pages.router)

    # Vite build assets (JS/CSS hashed files under /assets)
    assets_dir = SPA_DIR / "assets"
    if assets_dir.is_dir():
        application.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="spa-assets",
        )

    @application.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        """SPA deep-link fallback for client-side routes (and public/ files)."""
        if full_path.startswith("api/") or full_path in {
            "docs",
            "redoc",
            "openapi.json",
        }:
            raise HTTPException(404)
        candidate = SPA_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        index = SPA_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(
            404, "Frontend not built. Run: cd frontend && npm run build"
        )

    return application


app = create_app()
