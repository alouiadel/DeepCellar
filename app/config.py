from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CHAT_COLUMNS = "id, title, model, created_at, updated_at"

OLLAMA_UNREACHABLE_MSG = (
    "Ollama is not reachable. Start it with `ollama serve` or open the Ollama app."
)
