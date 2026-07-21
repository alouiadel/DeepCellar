# DeepCellar — What's Next

Roadmap toward the RAG-first goal, then MCP and agents. Each milestone is
self-contained and shippable.

## Milestone A — Persistent chat sessions (NEXT)

Chat history currently lives only in the page (lost on reload). Persist it
per user in SQLite; RAG features later attach to these sessions.

**Database** (`app/db.py`, two new tables, `PRAGMA foreign_keys = ON`):

```sql
chats(id, user_id -> users.id, title, model, created_at, updated_at)
messages(id, chat_id -> chats.id ON DELETE CASCADE,
         role, content, thinking, created_at)
```

**API** (`app/main.py`):

| Endpoint                    | Purpose                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/chats`            | List my chats, most recent first                                                                        |
| `POST /api/chats`           | Create chat `{model}`                                                                                   |
| `GET /api/chats/{id}`       | Chat + full message history (404 if not mine)                                                           |
| `PATCH /api/chats/{id}`     | Rename                                                                                                  |
| `DELETE /api/chats/{id}`    | Delete (cascades messages)                                                                              |
| `POST /api/chat` (extended) | Optional `chat_id`: while streaming, capture the reply and persist user + assistant messages atomically |

Design note: the streaming proxy persists — it already sees the full
history and tees the stream, so no extra client calls and no client/server
drift. Auto-title from the first user message (truncated ~40 chars).

**UI**: left sidebar on the chat page — "New chat" button, session list
(title + relative time, active highlighted, delete on hover), click to
load history rendered as markdown. Switching models starts a fresh chat
(model stored per chat). Unsaved single-chat behavior remains when no
`chat_id` is used.

**Tests**: curl flow — create chat, stream a turn with `chat_id`, verify
both messages persisted + title set, list/get/rename/delete, cross-user
access returns 404.

## Milestone B — Basic RAG

**Ingest** — `POST /api/documents` accepts `.txt` / `.md` / `.pdf`
(`pypdf` for PDFs). Extract text, chunk (recursive splitting, ~500 tokens
with overlap), embed each chunk with the already-installed
`embeddinggemma` via Ollama's native `/api/embed`.

**Store** — `sqlite-vec` virtual table (768-dim vectors) plus
`documents` / `chunks` tables. The vector index lives inside the same
`deepcellar.db`; `sqlite-vec` is the one new pip dependency.

**Retrieve** — on each user message: embed the query, `vec0` top-k
(k ≈ 4), inject chunks as context into `/api/chat`, and return the sources
used so the UI can show them under the reply.

**UI** — Knowledge page (list/delete documents), per-chat "use knowledge
base" toggle, sources displayed under assistant replies.

## Milestone C — Deeper AI features

- MCP integration (tools for the chat models)
- Agent-style capabilities
- Side-by-side model comparison (send one prompt to two models, compare responses)
- Hybrid search (keyword + vector)
- Stop-generation button, context-length guard
- Per-user preferences (system prompt, defaults)

## Beyond core — adoption and longevity

- **Deployment**: Docker image, single-file binaries (PyInstaller/Nuitka),
  1-click deploy buttons (Render, Railway, Hugging Face Spaces)
- **Plugin architecture**: custom tools, storage backends, auth plugins
  without touching core code
- **CI pipeline**: GitHub Actions for tests + linting on every PR
- **Visibility**: live demo on Hugging Face Spaces, GIF/video for README,
  community launches (r/LocalLLAMA, Show HN)
