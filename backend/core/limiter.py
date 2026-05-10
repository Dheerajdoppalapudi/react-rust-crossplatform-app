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
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
