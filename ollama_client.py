import json
import os
from collections.abc import AsyncGenerator

import httpx

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
TIMEOUT = httpx.Timeout(3.0, connect=1.5)
# No read timeout for chat streams: local models can take a while between chunks
CHAT_TIMEOUT = httpx.Timeout(None, connect=1.5)


class OllamaUnreachable(Exception):
    """Raised when the Ollama server cannot be reached."""


def _summarize(model: dict) -> dict:
    details = model.get("details") or {}
    capabilities = model.get("capabilities") or []
    cloud = bool(model.get("remote_host"))
    return {
        "name": model.get("name", ""),
        "cloud": cloud,
        "remote_host": model.get("remote_host") if cloud else None,
        "thinking": "thinking" in capabilities,
        "capabilities": capabilities,
        "family": details.get("family") or "",
        "parameter_size": details.get("parameter_size") or "",
        "quantization": details.get("quantization_level") or "",
        "format": details.get("format") or "",
        "context_length": details.get("context_length"),
        "size_bytes": model.get("size") or 0,
        "modified_at": model.get("modified_at", ""),
    }


def _fetch_capabilities(name: str) -> list[str]:
    """Fallback for older Ollama versions that don't expose capabilities in /api/tags."""
    resp = httpx.post(f"{OLLAMA_HOST}/api/show", json={"model": name}, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("capabilities") or []


def list_models() -> dict:
    """List Ollama models grouped into cloud vs local, with a `thinking` flag."""
    try:
        resp = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=TIMEOUT)
        resp.raise_for_status()
        raw_models = resp.json().get("models", [])
        for m in raw_models:
            if "capabilities" not in m:
                m["capabilities"] = _fetch_capabilities(m["name"])
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
        raise OllamaUnreachable(str(exc)) from exc

    models = sorted(
        (_summarize(m) for m in raw_models), key=lambda m: m["name"].lower()
    )
    return {
        "cloud": [m for m in models if m["cloud"]],
        "local": [m for m in models if not m["cloud"]],
    }


async def stream_chat(
    model: str, messages: list[dict], think: bool
) -> AsyncGenerator[str, None]:
    """Stream NDJSON lines from Ollama's /api/chat.

    Memory is conversational: the caller resends the full message history each
    time (Ollama's chat API is stateless). On failure, a final
    {"done": true, "error": "..."} line is yielded instead of raising.
    """
    payload = {"model": model, "messages": messages, "think": think}
    try:
        async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
            async with client.stream(
                "POST", f"{OLLAMA_HOST}/api/chat", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line + "\n"
    except httpx.HTTPStatusError as exc:
        yield (
            json.dumps(
                {"done": True, "error": f"Ollama error {exc.response.status_code}"}
            )
            + "\n"
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        yield (
            json.dumps(
                {
                    "done": True,
                    "error": "Ollama is not reachable. Start it with `ollama serve`.",
                }
            )
            + "\n"
        )
