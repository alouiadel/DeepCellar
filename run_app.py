from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="DeepCellar")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


# Serve static assets (style.css, script.js, ...)
app.mount("/", StaticFiles(directory=BASE_DIR), name="static")


if __name__ == "__main__":
    uvicorn.run("run_app:app", host="127.0.0.1", port=8000, reload=True)
