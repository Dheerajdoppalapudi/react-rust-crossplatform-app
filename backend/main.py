"""
Zenith API — application entry point.

Responsibilities of this file (and only this file):
  1. Configure logging (must happen before any other import that uses loggers)
  2. Create the FastAPI app
  3. Register middleware
  4. Include routers
  5. Register startup/shutdown hooks
  6. Run uvicorn when executed directly
"""

from core.logging_config import setup_logging

setup_logging()

import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import CORS_ORIGINS
from core.database import init_db
from routers import conversations, generation, sessions, upload, video

logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Zenith API started")
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Zenith API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(generation.router)
app.include_router(conversations.router)
app.include_router(sessions.router)
app.include_router(video.router)
app.include_router(upload.router)

# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception  path=%s", request.url.path, exc_info=True)
    return JSONResponse({"error": "Internal server error"}, status_code=500)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ── Dev server ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
