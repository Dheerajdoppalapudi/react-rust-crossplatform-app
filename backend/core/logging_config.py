"""
Logging setup — call setup_logging() once at process start (in main.py).

Production (ENV=production): emits JSON lines via structlog so log
aggregators (CloudWatch, Datadog, Loki) can query structured fields.

Development: emits human-readable coloured output via structlog's
ConsoleRenderer.

All stdlib loggers (uvicorn, httpx, etc.) are wired into the same
structlog pipeline via ProcessorFormatter so every log line is uniform.

App code should use structlog directly:
    import structlog
    logger = structlog.get_logger(__name__)
    logger.info("event_name", key=value, ...)
"""

import logging
import logging.handlers
import os
from pathlib import Path

import structlog

_IS_PRODUCTION = os.getenv("ENV", "development") == "production"


def setup_logging() -> None:
    log_dir = Path(__file__).parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if _IS_PRODUCTION
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    file_handler = logging.handlers.RotatingFileHandler(
        log_dir / "app.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(console)
    root.addHandler(file_handler)

    for noisy in ("httpx", "httpcore", "openai", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
