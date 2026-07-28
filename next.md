# DeepCellar — What's Next

DeepCellar is becoming a minimalist, self-hosted AI hub for companies: a
RAG chatbot over company documents, tool-equipped agents, and everyday AI
utilities. One command, one SQLite file, fully offline.

## Milestone A — Persistent chat sessions (DONE)

Shipped: full chats CRUD, stream persistence with auto-titles, sidebar
UI (chats auto-create on the first message, reload restores the active
chat), pytest suite, GitHub Actions CI (ruff + prettier + pytest).

## Milestone B — Basic RAG (NEXT)

- `POST /api/documents` accepts `.txt` / `.md` / `.pdf` (`pypdf`); chunk
  (~500 tokens with overlap), embed each chunk with `embeddinggemma` via
  Ollama's `/api/embed`
- `sqlite-vec` virtual table plus `documents` / `chunks` tables, all
  inside `deepcellar.db`
- Per user message: embed the query, top-k (k ≈ 4), inject chunks as
  context, return sources; the UI shows them under the reply
- Knowledge page (list/delete documents), per-chat knowledge toggle

## Milestone B2 — Company layer

- `role` column on `users` (admin/user); first registered user is admin
- Admin panel: user management, model allowlist, branding (name, logo,
  accent color), default system prompt — backed by a settings table
- Documents get `visibility`: `private` (owner only) or `shared`
  (company-wide knowledge base)

## Milestone C — Agents

- MCP client (the `mcp` package) connecting to user-configured MCP
  servers, plus a built-in web-fetch tool
- Tool-calling loop in the chat proxy, with steps visible in the UI

## Milestone D — Toolbox

- Everyday utilities as curated prompt templates: summarize, translate,
  rewrite, extract-to-JSON, meeting notes
- One page: template picker, input, streamed output

## Milestone E — Packaging & visibility

- One simple Dockerfile (`python run_app.py` stays the primary path)
- Live demo, README GIFs + architecture diagram, community launches
