# Contributing to DeepCellar

DeepCellar has a clear design philosophy. Please read this before opening a
pull request — PRs that don't respect these guidelines will be closed.

## Core principles

### 1. Local-first

DeepCellar talks to a **local Ollama instance** on the user's machine.
Cloud model support is purely informative (the dashboard shows which models
are remote in Ollama's catalog). Do not add cloud API keys, `.env` provider
config, or OpenAI-compatible proxy logic. The backend has no business
calling external LLM APIs.

### 2. Minimal, focused changes

A pull request should touch **as few files as possible** and have **one
clear idea**. If your change spans more than 3–5 files or mixes unrelated
concerns (e.g., "refactor auth + add Docker"), it is too big. Split it.

Big rewrites and architectural overhauls are not welcome — the project
values simplicity and maintainability over abstraction.

### 3. Vanilla HTML / CSS / JS — no frameworks

The frontend is deliberately built with **plain HTML, CSS, and
JavaScript**. No React, Vue, Svelte, Tailwind, or any other framework.
This keeps the project easy to maintain, customize, and understand for
contributors of all levels.

Pull requests that introduce build steps, bundlers, transpilers, or JS
frameworks will be rejected.

### 4. Follow `next.md`

The roadmap in `next.md` defines what the project needs next. If your PR
doesn't implement something on that roadmap, it's unlikely to be accepted
unless it's a bug fix or a trivial improvement. Always check `next.md`
first.

## General guidelines

- **Format your code** — run `ruff check --fix . && ruff format .` for
  Python and `prettier --write .` for HTML/CSS/JS before committing.
- **Don't add dependencies** unless absolutely necessary. Every new pip or
  npm dependency is a maintenance burden. If you do add one, justify it in
  the PR description.
- **Don't restructure the project** — the `app/`, `pages/`, `static/`
  layout is intentional. Moving files into subdirectories or renaming
  packages adds churn without benefit.
- **Keep the backend flat** — routers, schemas, and services subpackages
  are unnecessary for a project of this size. A single `main.py` with
  small, well-named modules in `app/` is the right structure.
- **Don't add Docker, Docker Compose, or container tooling.** DeepCellar
  is designed to run with a single `python run_app.py` command.
- **Don't swap out SQLite** — it's the right database for a local-first
  desktop-style app. Postgres, MySQL, or other external databases are not
  needed.
- **Bug fixes and documentation improvements** are always welcome, even if
  they're not on the roadmap.
- If you're unsure about a change, open an issue first to discuss it.

## How to contribute

1. Check `next.md` to see what's planned.
2. Open an issue or discussion to propose your change (optional but
   recommended for non-trivial work).
3. Fork the repo, make your changes on a branch.
4. Format your code.
5. Open a pull request with a clear title and description explaining what
   it does and why it's needed.
6. Be patient — maintainers review PRs when they can.
