"""
Centralised application configuration.

All os.getenv() calls and hard-coded paths live here.
Every other module imports from this file — nothing reads os.environ directly.

HIGH-10: Required secrets are validated at import time. The process will refuse
to start if JWT_SECRET_KEY is missing, rather than failing silently later.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Absolute path to the backend/ directory — used to build all other paths.
BASE_DIR: Path = Path(__file__).parent.parent

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
]

# ── Storage paths ─────────────────────────────────────────────────────────────
DB_PATH: Path     = BASE_DIR / "database.sqlite"   # kept for local fallback / tests
UPLOAD_DIR: Path  = BASE_DIR / "uploads"
OUTPUTS_DIR: Path = BASE_DIR / "outputs"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# ── AWS S3 + CloudFront ───────────────────────────────────────────────────────
AWS_REGION:        str = os.getenv("AWS_REGION", "us-east-1")
S3_MEDIA_BUCKET:   str = os.getenv("S3_MEDIA_BUCKET", "")
S3_UPLOADS_BUCKET: str = os.getenv("S3_UPLOADS_BUCKET", "")
CLOUDFRONT_DOMAIN: str = os.getenv("CLOUDFRONT_DOMAIN", "")

# ── LLM API keys ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY: str    = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY: str    = os.getenv("GEMINI_API_KEY", "")

# ── LLM models ────────────────────────────────────────────────────────────────
OPENAI_MODEL: str  = os.getenv("OPENAI_MODEL",  "gpt-4.1")
CLAUDE_MODEL: str  = os.getenv("CLAUDE_MODEL",  "claude-haiku-4-5-20251001")
GEMINI_MODEL: str  = os.getenv("GEMINI_MODEL",  "gemini-2.5-flash")
# Fast model used only for intent classification + planning (~300 tokens, simple task).
CLASSIFY_MODEL: str = os.getenv("CLASSIFY_MODEL", "gemini-2.5-flash")

# Models the user may request — validated on every /api/generate call.
# Add new models here when they become available; never trust raw user input.
ALLOWED_CLAUDE_MODELS: frozenset[str] = frozenset({
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
})
ALLOWED_OPENAI_MODELS: frozenset[str] = frozenset({
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
})
ALLOWED_GEMINI_MODELS: frozenset[str] = frozenset({
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
})

# ── Per-task model routing ─────────────────────────────────────────────────────
# When the user selects "Auto" in the UI, each pipeline step uses its own model.
# Override any task via env var (e.g. MODEL_SCENE_PLANNER=gpt-4.1).
#
# Cost rationale for defaults:
#   Gemini Flash 2.5 : $0.15/$0.60 per 1M tokens   — structured tasks + reasoning
#   Claude Sonnet 4.6: $3/$15 per 1M tokens         — complex reasoning
#   Haiku 4.5        : $0.80/$4 per 1M tokens       — synthesis streaming (native support)
TASK_MODELS: dict = {
    "entity_selector": os.getenv("MODEL_ENTITY_SELECTOR", "gemini-2.5-flash"),
    "scene_planner":   os.getenv("MODEL_SCENE_PLANNER",   "gemini-2.5-flash"),
    "vocab_plan":      os.getenv("MODEL_VOCAB_PLAN",       "gemini-2.5-flash"),
    "svg_frame":       os.getenv("MODEL_SVG_FRAME",        "gemini-2.5-flash"),
    "beat_planner":    os.getenv("MODEL_BEAT_PLANNER",     "claude-sonnet-4-6"),
    "beat_codegen":    os.getenv("MODEL_BEAT_CODEGEN",     "gemini-2.5-flash"),
    "synthesiser":     os.getenv("MODEL_SYNTHESISER",      "claude-haiku-4-5-20251001"),
    "codegen":         os.getenv("MODEL_CODEGEN",          "gemini-2.5-flash"),
}

# ── Refresh token bounding ────────────────────────────────────────────────────
# Old tokens beyond this limit are pruned (oldest-first) on each new issuance.
MAX_REFRESH_TOKENS_PER_USER: int = int(os.getenv("MAX_REFRESH_TOKENS_PER_USER", "5"))

# ── Cost optimisation flags ───────────────────────────────────────────────────
# Anthropic prompt caching — marks large static prompt templates with
# cache_control so repeated calls reuse cached tokens at 10% of normal cost.
PROMPT_CACHE_ENABLED: bool = os.getenv("PROMPT_CACHE_ENABLED", "true").lower() != "false"

# ── Embeddings ───────────────────────────────────────────────────────────────
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

# ── Deep research ────────────────────────────────────────────────────────────
TAVILY_API_KEY:         str   = os.getenv("TAVILY_API_KEY", "")
DEEP_SEARCH_ROUNDS:     int   = int(os.getenv("DEEP_SEARCH_ROUNDS", "2"))
DEEP_SEARCH_QUERIES:    int   = int(os.getenv("DEEP_SEARCH_QUERIES", "5"))
DEEP_SEARCH_SOURCES:    int   = int(os.getenv("DEEP_SEARCH_SOURCES", "10"))
DEEP_SOURCES_IN_ANSWER: int   = int(os.getenv("DEEP_SOURCES_IN_ANSWER", "5"))
DEEP_MAX_TOKENS_SOURCE: int   = int(os.getenv("DEEP_MAX_TOKENS_SOURCE", "1200"))
DEEP_TIMEOUT_SECONDS:   float = float(os.getenv("DEEP_TIMEOUT_SECONDS", "90"))

# ── External services ─────────────────────────────────────────────────────────

# ── Video / TTS ───────────────────────────────────────────────────────────────
VIDEO_WIDTH: int  = 1920
VIDEO_HEIGHT: int = 1080
VIDEO_FPS: int    = 24
TTS_WORDS_PER_SECOND: float = 2.3

# ── Auth ──────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

# HIGH-10: Fail fast if JWT_SECRET_KEY is missing — no silent default.
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

JWT_ALGORITHM:    str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES:  int = 15
REFRESH_TOKEN_EXPIRE_DAYS:    int = 30
# Short-lived tokens for media endpoints (video / frame images).
# Scoped to a session — even if intercepted, they expire in 5 minutes.
MEDIA_TOKEN_EXPIRE_MINUTES: int = 5

# COOKIE_SECURE=True forces HTTPS-only cookies — set ENV=production on the server
COOKIE_SECURE:   bool = os.getenv("ENV", "development") == "production"
COOKIE_SAMESITE: str  = "lax"

# ── Feature flags ────────────────────────────────────────────────────────────

# ── Intent routing ────────────────────────────────────────────────────────────
# process/architecture/timeline previously routed to mermaid — now handled by SVG.
MANIM_INTENT_TYPES: frozenset[str] = frozenset({"math"})
SVG_INTENT_TYPES: frozenset[str]   = frozenset({
    "illustration", "concept_analogy", "comparison",
    "process", "architecture", "timeline",
})

# ── SVG animation ─────────────────────────────────────────────────────────────
# Set to "false" to revert to cairosvg static PNG (no Playwright needed).
SVG_ANIMATION_ENABLED: bool = os.getenv("SVG_ANIMATION_ENABLED", "true").lower() != "false"

# ── Interactive mode ──────────────────────────────────────────────────────────
# Domains that have a dedicated domain guidance file in
# services/interactive/prompts/domains/{domain}.md.
# Add a new domain here + create the .md file — no other code change needed.
INTERACTIVE_DOMAINS: frozenset[str] = frozenset({"physics", "cs", "chemistry", "biology", "math", "history"})

# How many prior interactive sessions to include in the follow-up context window.
# Each session contributes its text blocks + entity summaries from scene_ir.json.
INTERACTIVE_CONTEXT_TURNS: int = 3

# ── Unified pipeline ──────────────────────────────────────────────────────────
FOLLOWUP_CONTEXT_TURNS: int  = int(os.getenv("FOLLOWUP_CONTEXT_TURNS", "3"))
INSTANT_MAX_QUERIES:    int  = int(os.getenv("INSTANT_MAX_QUERIES",    "3"))
DEEP_MAX_QUERIES:       int  = int(os.getenv("DEEP_MAX_QUERIES",       "5"))
FOLLOWUP_TOP_K_SOURCES: int  = int(os.getenv("FOLLOWUP_TOP_K_SOURCES", "8"))
CHROMADB_PATH:          Path = BASE_DIR / os.getenv("CHROMADB_DIR", "chromadb")

# ── Generation constants ──────────────────────────────────────────────────────
HEARTBEAT_INTERVAL_SECS:      int = int(os.getenv("HEARTBEAT_INTERVAL_SECS", "20"))
CONVERSATION_TITLE_MAX_CHARS: int = int(os.getenv("CONVERSATION_TITLE_MAX_CHARS", "80"))
LLM_DEFAULT_MAX_TOKENS:       int = int(os.getenv("LLM_DEFAULT_MAX_TOKENS", "4096"))
MAX_FRAMES_JSON_BYTES:        int = int(os.getenv("MAX_FRAMES_JSON_BYTES", "10000000"))
SOURCES_SNIPPET_MAX_CHARS:    int = int(os.getenv("SOURCES_SNIPPET_MAX_CHARS", "7000"))
SOURCES_TOP_K:                int = int(os.getenv("SOURCES_TOP_K", "8"))
SCENE_PLANNER_MAX_TOKENS:     int = int(os.getenv("SCENE_PLANNER_MAX_TOKENS", "8192"))

# ── Beat pipeline ─────────────────────────────────────────────────────────────
# Set BEAT_PIPELINE_ENABLED=false to fall back to legacy manim_generator_legacy.py
BEAT_PIPELINE_ENABLED:        bool = os.getenv("BEAT_PIPELINE_ENABLED", "true").lower() != "false"
BEAT_MAX_CONCURRENT_RENDERS:  int  = int(os.getenv("BEAT_MAX_CONCURRENT_RENDERS", "3"))
BEAT_RENDER_TIMEOUT_S:        int  = int(os.getenv("BEAT_RENDER_TIMEOUT_S", "90"))
BEAT_RENDER_QUALITY:          str  = os.getenv("BEAT_RENDER_QUALITY", "-qm")
BEAT_CACHE_DIR:               Path = OUTPUTS_DIR / "beat_cache"
BEAT_PLANNER_MODEL:           str  = os.getenv("BEAT_PLANNER_MODEL", "claude-sonnet-4-6")
# "openai" (higher quality, needs OPENAI_API_KEY) or "gtts" (free, no key needed)
BEAT_TTS_BACKEND:             str  = os.getenv("BEAT_TTS_BACKEND", "openai")
