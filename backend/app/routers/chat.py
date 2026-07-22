from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_username
from app.schemas.chat import ChatRequest
from app.services import llm

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(
    body: ChatRequest, username: str = Depends(get_current_username)
) -> StreamingResponse:
    del username  # auth gate only
    messages = [m.model_dump(exclude_none=True) for m in body.messages]
    stream = llm.stream_chat(body.model, messages, body.think)
    return StreamingResponse(stream, media_type="application/x-ndjson")
