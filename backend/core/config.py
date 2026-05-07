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
DB_PATH: Path     = BASE_DIR / "database.sqlite"
UPLOAD_DIR: Path  = BASE_DIR / "uploads"
OUTPUTS_DIR: Path = BASE_DIR / "outputs"

# ── LLM models ────────────────────────────────────────────────────────────────
OPENAI_MODEL: str  = os.getenv("OPENAI_MODEL",  "gpt-4.1")
CLAUDE_MODEL: str  = os.getenv("CLAUDE_MODEL",  "claude-sonnet-4-6")
# Cheap/fast model used only for intent classification (~300 tokens, simple task).
# Always uses Haiku regardless of the user's chosen model.
CLASSIFY_MODEL: str = os.getenv("CLASSIFY_MODEL", "claude-haiku-4-5-20251001")

# ── Cost optimisation flags ───────────────────────────────────────────────────
# Anthropic prompt caching — marks large static prompt templates with
# cache_control so repeated calls reuse cached tokens at 10% of normal cost.
PROMPT_CACHE_ENABLED: bool = os.getenv("PROMPT_CACHE_ENABLED", "true").lower() != "false"

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
