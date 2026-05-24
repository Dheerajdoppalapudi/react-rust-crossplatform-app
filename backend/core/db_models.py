"""
Typed dataclasses for database rows.

These prevent raw dict passing across layers and give IDE auto-complete.
They are NOT ORM models — they are plain Python dataclasses that map to DB rows.

Timestamp fields use datetime (timezone-aware) after the 002_timestamptz_migration.
asyncpg returns TIMESTAMPTZ columns as Python datetime objects automatically.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class User:
    id:            str   # Google sub or UUID for password users
    email:         str
    name:          str            = field(default="")
    avatar:        str            = field(default="")
    created_at:    Optional[datetime] = field(default=None)
    last_login:    Optional[datetime] = field(default=None)
    password_hash: Optional[str]  = field(default=None)
    auth_provider: str            = field(default="google")  # 'google' | 'password'
