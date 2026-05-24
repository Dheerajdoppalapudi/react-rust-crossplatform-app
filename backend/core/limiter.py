"""
Module-level slowapi limiter singleton.

Defined here (not in main.py) so routers can import it without creating
a circular dependency through main.py.

Import pattern in any router:
    from core.limiter import limiter

    @router.post("/my-endpoint")
    @limiter.limit("10/minute")
    async def my_handler(request: Request, ...):
        ...

The app must still wire the limiter into FastAPI state at startup:
    app.state.limiter = limiter          # in main.py
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

For per-user limits, pass key_func=get_user_key to @limiter.limit():
    @limiter.limit("10/minute", key_func=get_user_key)
"""

import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import JWT_ALGORITHM, JWT_SECRET_KEY

limiter = Limiter(key_func=get_remote_address)


def get_user_key(request: Request) -> str:
    """
    Rate-limit key that identifies the authenticated user rather than the IP.

    Falls back to IP address for unauthenticated requests so that the limiter
    still fires correctly even if the JWT is missing or malformed. This fallback
    matters for auth endpoints — but generate requires auth anyway so it'll always
    get the user key there.
    """
    try:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = jwt.decode(
                auth[7:], JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
            )
            if user_id := payload.get("sub"):
                return f"user:{user_id}"
    except Exception:
        pass
    return get_remote_address(request)
