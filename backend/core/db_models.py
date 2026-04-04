"""
Typed dataclasses for database rows.

These prevent raw dict passing across layers and give IDE auto-complete.
They are NOT ORM models — they are plain Python dataclasses that map to SQLite rows.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class User:
    id:            str   # Google sub or UUID for password users
    email:         str
    name:          str
    avatar:        str
    created_at:    str
    last_login:    str
    password_hash: Optional[str] = field(default=None)
    auth_provider: str           = field(default="google")  # 'google' | 'password'
