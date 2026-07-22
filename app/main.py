"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import db
from app.config import PROJECT_ROOT
from app.routers import auth, chat, models, pages


def create_app() -> FastAPI:
    application = FastAPI(title="DeepCellar")
    db.init_db()

    application.include_router(auth.router)
    application.include_router(chat.router)
    application.include_router(models.router)
    application.include_router(pages.router)

    # Only static/ is public — source, DB, and secrets stay private.
    application.mount(
        "/static",
        StaticFiles(directory=PROJECT_ROOT / "static"),
        name="static",
    )
    return application


app = create_app()
