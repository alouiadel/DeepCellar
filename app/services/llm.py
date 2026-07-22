"""LLM provider facade: Ollama or OpenAI-compatible (AI Grid / OpenAI)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from app.config import uses_openai_compatible
from app.services import ollama, openai


class ProviderUnreachable(Exception):
    """Unified unreachable error for any configured provider."""


def list_models() -> dict:
    if uses_openai_compatible():
        try:
            return openai.list_models()
        except openai.ProviderUnreachable as exc:
            raise ProviderUnreachable(str(exc)) from exc
    try:
        data = ollama.list_models()
        data["provider"] = "ollama"
        return data
    except ollama.OllamaUnreachable as exc:
        raise ProviderUnreachable(str(exc)) from exc


async def stream_chat(
    model: str, messages: list[dict], think: bool
) -> AsyncGenerator[str, None]:
    if uses_openai_compatible():
        async for line in openai.stream_chat(model, messages, think):
            yield line
        return
    async for line in ollama.stream_chat(model, messages, think):
        yield line


def unreachable_message() -> str:
    if uses_openai_compatible():
        return (
            "AI provider is not reachable. Check AI_GRID_BASE_URL / "
            "OPENAI_BASE_URL and your API key."
        )
    return (
        "Ollama is not reachable. Start it with `ollama serve` or open the Ollama app."
    )
