"""
SVG component library — DB access + public API for the frame generation pipeline.

Icons live in the svg_components table in database.sqlite.
To seed or add components run:  python backend/scripts/seed_components.py

Each icon fits a fixed 100 × 120 bounding box:
  • artwork: y = 0 – 96
  • label:   y = 108, centred at x = 50

Templates use three placeholders substituted at call time:
  {fill}   — primary fill colour   (e.g. "#e8f4ff")
  {stroke} — stroke / text colour  (e.g. "#1971c2")
  {label}  — display name

Callers position icons with:
    <g transform="translate(X, Y)">
        {component.svg}
    </g>

DB API (also importable directly):
    init_db()                                              — create table if not exists
    lookup(key)              → dict | None                 — keyword match
    add(name, keywords, svg_template, category, w, h) → id
    update(name, **fields)                                 — patch any field
    delete(name)             → bool
    list_all()               → list[dict]
"""

import json
import os
import re
import sqlite3
from dataclasses import dataclass
from typing import Optional

# ── Database path: backend/database.sqlite ────────────────────────────────────
_DB_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "database.sqlite")
)


# ── DB helpers ────────────────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── DB public API ─────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create the svg_components table if it doesn't exist. Safe to call on import."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS svg_components (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT    UNIQUE NOT NULL,
                keywords     TEXT    NOT NULL,
                svg_template TEXT    NOT NULL,
                width        INTEGER NOT NULL DEFAULT 100,
                height       INTEGER NOT NULL DEFAULT 120,
                category     TEXT    NOT NULL DEFAULT 'general',
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


def lookup(key: str) -> Optional[dict]:
    """
    Return the first row whose keyword list has a substring match inside key.
    Uses the same logic as the original in-memory library: any keyword ∈ key_lower.
    """
    key_lower = key.lower().replace("_", " ")
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM svg_components").fetchall()
    for row in rows:
        keywords: list[str] = json.loads(row["keywords"])
        if any(kw in key_lower for kw in keywords):
            return {
                "id":           row["id"],
                "name":         row["name"],
                "keywords":     keywords,
                "svg_template": row["svg_template"],
                "width":        row["width"],
                "height":       row["height"],
                "category":     row["category"],
                "created_at":   row["created_at"],
            }
    return None


def add(
    name: str,
    keywords: list[str],
    svg_template: str,
    category: str = "general",
    width: int = 100,
    height: int = 120,
) -> int:
    """Insert a new component. Returns the new row id."""
    with _connect() as conn:
        cur = conn.execute(
            """INSERT INTO svg_components (name, keywords, svg_template, category, width, height)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, json.dumps(keywords), svg_template, category, width, height),
        )
        conn.commit()
        return cur.lastrowid


def update(name: str, **fields) -> bool:
    """
    Patch mutable fields of an existing component by name.
    Accepted: keywords (list), svg_template, category, width, height.
    """
    allowed = {"keywords", "svg_template", "category", "width", "height"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    if "keywords" in updates and isinstance(updates["keywords"], list):
        updates["keywords"] = json.dumps(updates["keywords"])
    set_clause = ", ".join(f"{col} = ?" for col in updates)
    values = list(updates.values()) + [name]
    with _connect() as conn:
        cur = conn.execute(
            f"UPDATE svg_components SET {set_clause} WHERE name = ?", values
        )
        conn.commit()
        return cur.rowcount > 0


def delete(name: str) -> bool:
    """Remove a component by name. Returns True if it existed."""
    with _connect() as conn:
        cur = conn.execute("DELETE FROM svg_components WHERE name = ?", (name,))
        conn.commit()
        return cur.rowcount > 0


def list_all() -> list[dict]:
    """Return all components as plain dicts, ordered by category then name."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM svg_components ORDER BY category, name"
        ).fetchall()
    return [
        {
            "id":           r["id"],
            "name":         r["name"],
            "keywords":     json.loads(r["keywords"]),
            "svg_template": r["svg_template"],
            "width":        r["width"],
            "height":       r["height"],
            "category":     r["category"],
            "created_at":   r["created_at"],
        }
        for r in rows
    ]


# ── Initialise table on import ────────────────────────────────────────────────
init_db()


# ── Pipeline types + public API ───────────────────────────────────────────────

@dataclass
class SVGComponent:
    """A single pre-built SVG icon."""
    svg: str          # raw SVG markup (no surrounding <g>)
    width: int        # bounding box width
    height: int       # bounding box height
    right_edge_y: int = 0   # y midpoint of right edge (for rightward arrow source)
    bottom_edge_x: int = 0  # x midpoint of bottom edge (for downward arrow source)

    def __post_init__(self):
        # Default to geometric midpoints if not explicitly set
        if self.right_edge_y == 0:
            self.right_edge_y = self.height // 2
        if self.bottom_edge_x == 0:
            self.bottom_edge_x = self.width // 2


def _extract_label(spec, key: str) -> str:
    """Extract label text from an element_vocabulary spec (string or dict), or prettify the key."""
    if isinstance(spec, dict):
        return spec.get("label", key.replace("_", " ").title())
    m = re.search(r"label\s+'([^']+)'", spec, re.IGNORECASE)
    if m:
        return m.group(1)
    return key.replace("_", " ").title()


def get_builtin_component(
    key: str,
    spec,
    fill: str,
    stroke: str,
) -> Optional[SVGComponent]:
    """
    Return a pre-built SVGComponent for *key*, or None if no icon matches.

    Looks up svg_components in database.sqlite using keyword substring matching.
    spec may be a string (old planner format) or dict (new planner format).
    Run  python backend/scripts/seed_components.py  if the table is empty.
    """
    label = _extract_label(spec, key)
    row = lookup(key)
    if not row:
        return None
    svg = (
        row["svg_template"]
        .replace("{fill}",   fill)
        .replace("{stroke}", stroke)
        .replace("{label}",  label)
    )
    w = row["width"]
    h = row["height"]
    return SVGComponent(svg=svg, width=w, height=h, right_edge_y=h // 2, bottom_edge_x=w // 2)
