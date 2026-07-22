# DeepCellar frontend (React — modular)

## Layout

```
src/
├── app/                 # App shell: providers, router, Redux store
├── features/
│   ├── auth/            # Login/signup, ProtectedRoute, auth slice
│   ├── chat/            # Chat page, composer, streaming slice
│   └── models/          # Models dashboard + models slice
├── shared/
│   ├── api/             # fetch helpers
│   ├── layout/          # AppShell
│   ├── lib/             # cn(), utils
│   └── ui/              # shadcn-style primitives
├── main.jsx
└── index.css
```

Each feature exposes a public barrel (`index.js`). Import from `@/features/auth`, etc.

## Dev

```bash
# API on :8001
cd .. && .venv/bin/python -c "import uvicorn; uvicorn.run('run_app:app', host='127.0.0.1', port=8001, reload=True)"

# UI
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Docker

```bash
# from repo root
docker compose up --build -d
```

Frontend image builds from this folder (`frontend/Dockerfile` + `nginx.conf`).
