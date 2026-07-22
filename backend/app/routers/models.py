from fastapi import APIRouter, Depends, HTTPException, status

from app.config import DEFAULT_MODEL_LABEL, DEFAULT_MODEL_PROVIDER
from app.dependencies import get_current_username
from app.services import llm

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/me/config")
def client_config(username: str = Depends(get_current_username)) -> dict:
    """Non-secret client settings (provider + default model)."""
    del username  # auth gate only
    return {
        "provider": DEFAULT_MODEL_PROVIDER,
        "default_model": DEFAULT_MODEL_LABEL,
    }


@router.get("/models")
@router.get("/ollama/models")
def models(username: str = Depends(get_current_username)) -> dict:
    del username  # auth gate only
    try:
        return llm.list_models()
    except llm.ProviderUnreachable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            llm.unreachable_message(),
        ) from exc
