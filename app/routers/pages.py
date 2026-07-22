from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.config import PROJECT_ROOT
from app.dependencies import get_current_username

PAGES_DIR = PROJECT_ROOT / "pages"

router = APIRouter(tags=["pages"], include_in_schema=False)


@router.get("/")
def index() -> FileResponse:
    return FileResponse(PAGES_DIR / "index.html")


@router.get("/app.html")
def app_page(username: str = Depends(get_current_username)) -> FileResponse:
    del username  # auth gate only
    return FileResponse(PAGES_DIR / "app.html")


@router.get("/models.html")
def models_page(username: str = Depends(get_current_username)) -> FileResponse:
    del username  # auth gate only
    return FileResponse(PAGES_DIR / "models.html")
