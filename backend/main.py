"""
Zenith API — application entry point.

Responsibilities of this file (and only this file):
  1. Configure logging (must happen before any other import that uses loggers)
  2. Create the FastAPI app
  3. Register middleware
  4. Include routers
  5. Register startup/shutdown hooks
  6. Run uvicorn when executed directly

Fixes applied:
  M-3 : slowapi rate limiting on the generation endpoint (10 req/min per IP).
  M-10: Request ID middleware — every request gets a unique X-Request-ID header
        that propagates through logs for distributed tracing.
"""

from core.logging_config import setup_logging

setup_logging()

import logging
import uuid

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import CORS_ORIGINS
from core.database import init_db, get_db
from core.responses import success
from routers import auth, conversations, generate, sessions, upload, video

logger = logging.getLogger(__name__)


# ── Rate limiter (M-3) ────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("zenith_api_started")
    yield
    logger.info("zenith_api_stopped")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Zenith API", lifespan=lifespan)

# M-3: Attach limiter to app state so slowapi middleware can read it.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID middleware (M-10) ──────────────────────────────────────────────

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """
    M-10: Attach a unique request ID to every request.
    If the caller supplies X-Request-ID we echo it back; otherwise we generate one.
    The ID is added to the response header so it can be correlated in client logs.
    """
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    # Store on request state so route handlers / dependencies can read it.
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(conversations.router)
app.include_router(sessions.router)
app.include_router(video.router)
app.include_router(upload.router)

# ── Exception handlers ────────────────────────────────────────────────────────
# All error responses follow the same envelope: { "status": "error", "error": "..." }

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        {"status": "error", "error": exc.detail},
        status_code=exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Collect field-level errors into a single readable string
    messages = "; ".join(
        f"{' → '.join(str(l) for l in e['loc'])}: {e['msg']}"
        for e in exc.errors()
    )
    return JSONResponse(
        {"status": "error", "error": f"Validation error: {messages}"},
        status_code=422,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception  path=%s  request_id=%s",
        request.url.path,
        getattr(request.state, "request_id", "unknown"),
        exc_info=True,
    )
    return JSONResponse({"status": "error", "error": "Internal server error"}, status_code=500)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    """
    Liveness + readiness probe.
    Verifies the database is reachable — returns 503 if not.
    """
    try:
        with get_db() as conn:
            conn.execute("SELECT 1").fetchone()
        db_ok = True
    except Exception:
        logger.error("health_check_db_failed", exc_info=True)
        db_ok = False

    if not db_ok:
        return JSONResponse(
            {"status": "error", "error": "Database unavailable"},
            status_code=503,
        )

    return success({"status": "ok", "db": "ok"})


# ── Dev server ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
