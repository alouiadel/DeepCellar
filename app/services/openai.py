"""OpenAI-compatible chat client (AI Grid, OpenAI, LiteLLM, …).

Streams are converted to the same Ollama-style NDJSON the frontend expects:
  {"message": {"role": "assistant", "content": "..."}, "done": false}
  {"done": true}
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import httpx

from app.config import (
    DEFAULT_MODEL_LABEL,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
)

TIMEOUT = httpx.Timeout(10.0, connect=3.0)
CHAT_TIMEOUT = httpx.Timeout(None, connect=3.0)

# Name fragments that are usually not chat-completion models
_NON_CHAT_HINTS = ("embed", "embedding", "gte-", "ocr", "whisper", "tts", "rerank")


class ProviderUnreachable(Exception):
    """Raised when the OpenAI-compatible provider cannot be reached."""


def _headers() -> dict[str, str]:
    if not OPENAI_API_KEY:
        raise ProviderUnreachable(
            "API key missing. Set AI_GRID_API_KEY or OPENAI_API_KEY in .env."
        )
    return {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }


def _is_chatable(model_id: str) -> bool:
    lowered = model_id.lower()
    return not any(hint in lowered for hint in _NON_CHAT_HINTS)


def _is_thinking(model_id: str) -> bool:
    lowered = model_id.lower()
    return "thinking" in lowered or "reason" in lowered


def _summarize(model_id: str) -> dict:
    return {
        "name": model_id,
        "cloud": True,
        "remote_host": OPENAI_BASE_URL,
        "thinking": _is_thinking(model_id),
        "chatable": _is_chatable(model_id),
        "capabilities": ["completion"] if _is_chatable(model_id) else [],
        "family": "",
        "parameter_size": "",
        "quantization": "",
        "format": "",
        "context_length": None,
        "size_bytes": 0,
        "modified_at": "",
    }


def list_models() -> dict:
    """List models from GET /models; default model sorted first under cloud."""
    try:
        resp = httpx.get(
            f"{OPENAI_BASE_URL}/models",
            headers=_headers(),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        raw = resp.json().get("data") or []
    except ProviderUnreachable:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
        raise ProviderUnreachable(str(exc)) from exc

    ids = [m.get("id", "") for m in raw if m.get("id")]
    if DEFAULT_MODEL_LABEL and DEFAULT_MODEL_LABEL not in ids:
        ids.insert(0, DEFAULT_MODEL_LABEL)

    models = [_summarize(mid) for mid in ids]

    def sort_key(m: dict) -> tuple:
        # Prefer default model, then chatable, then name
        return (
            0 if m["name"] == DEFAULT_MODEL_LABEL else 1,
            0 if m["chatable"] else 1,
            m["name"].lower(),
        )

    models.sort(key=sort_key)
    return {"provider": "openai", "cloud": models, "local": []}


def _openai_messages(messages: list[dict]) -> list[dict]:
    """Strip Ollama-only fields (e.g. thinking) before calling the provider."""
    return [{"role": m["role"], "content": m.get("content") or ""} for m in messages]


async def stream_chat(
    model: str, messages: list[dict], think: bool = False
) -> AsyncGenerator[str, None]:
    """Stream chat completions and yield Ollama-compatible NDJSON lines."""
    del think  # OpenAI-compatible path does not use Ollama's think flag
    payload = {
        "model": model,
        "messages": _openai_messages(messages),
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{OPENAI_BASE_URL}/chat/completions",
                headers=_headers(),
                json=payload,
            ) as resp:
                if resp.status_code >= 400:
                    body = (await resp.aread()).decode("utf-8", errors="replace")
                    yield (
                        json.dumps(
                            {
                                "done": True,
                                "error": (
                                    f"Provider error {resp.status_code}: {body[:300]}"
                                ),
                            }
                        )
                        + "\n"
                    )
                    return

                finished = False
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data = line[5:].strip()
                    else:
                        data = line.strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        if not finished:
                            finished = True
                            yield json.dumps({"done": True}) + "\n"
                        continue
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for choice in chunk.get("choices") or []:
                        delta = choice.get("delta") or {}
                        content = delta.get("content") or ""
                        reasoning = (
                            delta.get("reasoning_content")
                            or delta.get("reasoning")
                            or ""
                        )
                        msg: dict = {"role": "assistant"}
                        if reasoning:
                            msg["thinking"] = reasoning
                        if content:
                            msg["content"] = content
                        if "content" in msg or "thinking" in msg:
                            yield (
                                json.dumps({"message": msg, "done": False}) + "\n"
                            )
                        if choice.get("finish_reason") and not finished:
                            finished = True
                            yield json.dumps({"done": True}) + "\n"
                if not finished:
                    yield json.dumps({"done": True}) + "\n"
    except ProviderUnreachable as exc:
        yield json.dumps({"done": True, "error": str(exc)}) + "\n"
    except (httpx.ConnectError, httpx.TimeoutException):
        yield (
            json.dumps(
                {
                    "done": True,
                    "error": (
                        f"AI provider is not reachable at {OPENAI_BASE_URL}. "
                        "Check AI_GRID_BASE_URL / OPENAI_BASE_URL."
                    ),
                }
            )
            + "\n"
        )
