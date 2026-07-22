# DeepCellar API (FastAPI)

## Layout

```
backend/
├── Dockerfile
├── requirements.txt
├── run_app.py
└── app/                 # FastAPI package
    ├── main.py
    ├── config.py
    ├── db.py
    ├── routers/
    ├── schemas/
    └── services/
```

## Local run

From repo root (uses existing `.venv` if present):

```bash
cd backend
../.venv/bin/pip install -r requirements.txt
../.venv/bin/python run_app.py
# or: ../.venv/bin/python -c "import uvicorn; uvicorn.run('run_app:app', host='127.0.0.1', port=8001, reload=True)"
```

## Docker

```bash
# from repo root
docker compose up --build backend

# or from this folder
docker build -t deepcellar-backend .
```
