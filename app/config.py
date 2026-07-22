"""Runtime configuration from environment / `.env`."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Persist secret key (and sqlite file when not using Postgres)
DATA_DIR = Path(os.environ.get("DATA_DIR", str(PROJECT_ROOT))).expanduser()
DATA_DIR.mkdir(parents=True, exist_ok=True)

# sqlite (default local) or postgresql://user:pass@host:5432/dbname
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{DATA_DIR / 'deepcellar.db'}"
).strip()

# `ollama` (default) or OpenAI-compatible providers: `ai_grid`, `openai`
DEFAULT_MODEL_PROVIDER = os.environ.get(
    "DEFAULT_MODEL_PROVIDER", "ollama"
).strip().lower()

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")

# OpenAI-compatible (AI Grid, OpenAI, LiteLLM, etc.)
AI_GRID_API_KEY = os.environ.get("AI_GRID_API_KEY", "").strip()
AI_GRID_BASE_URL = os.environ.get(
    "AI_GRID_BASE_URL", "http://app.ai-grid.io:4000/v1"
).rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip() or AI_GRID_API_KEY
OPENAI_BASE_URL = (
    os.environ.get("OPENAI_BASE_URL", "").strip().rstrip("/") or AI_GRID_BASE_URL
)

DEFAULT_MODEL_LABEL = os.environ.get(
    "DEFAULT_MODEL_LABEL", "google/gemma-4-31B"
).strip()


def uses_openai_compatible() -> bool:
    return DEFAULT_MODEL_PROVIDER in {"ai_grid", "openai"}


def uses_postgres() -> bool:
    return DATABASE_URL.startswith("postgres")
