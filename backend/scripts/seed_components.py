"""
One-time seed script — populates the svg_components table in database.sqlite.

Run from the backend/ directory:
    python scripts/seed_components.py

Safe to re-run: uses INSERT OR IGNORE so existing rows are never overwritten.
To add a new component just append to COMPONENTS below and re-run.
To update an existing one: edit it here, then run with --force to overwrite.

Usage:
    python scripts/seed_components.py            # skip rows that already exist
    python scripts/seed_components.py --force    # overwrite all rows with data below
"""

import json
import os
import sqlite3
import sys

DB_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "database.sqlite")
)

# ─────────────────────────────────────────────────────────────────────────────
# Component definitions
# Each entry: (name, keywords, svg_template, category, width, height)
#
# svg_template placeholders:
#   {fill}   — primary fill colour   (e.g. "#e8f4ff")
#   {stroke} — stroke / text colour  (e.g. "#1971c2")
#   {label}  — display label text
#
# Canvas: 100 × 120  (artwork 0-96 px, label at y=108)
# ─────────────────────────────────────────────────────────────────────────────

COMPONENTS: list[tuple[str, list[str], str, str, int, int]] = [

    # ── Browser ───────────────────────────────────────────────────────────────
    (
        "browser",
        ["browser", "chrome", "firefox", "web client", "client app"],
        """\
<!-- outer frame -->
<rect x="2" y="4" width="96" height="88" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- toolbar bar -->
<rect x="2" y="4" width="96" height="20" rx="5" fill="{stroke}"/>
<rect x="2" y="18" width="96" height="6" fill="{stroke}"/>
<!-- traffic-light dots -->
<circle cx="14" cy="14" r="4.5" fill="#ff5f57"/>
<circle cx="26" cy="14" r="4.5" fill="#febc2e"/>
<circle cx="38" cy="14" r="4.5" fill="#28c840"/>
<!-- address bar -->
<rect x="48" y="7" width="44" height="14" rx="3" fill="white" stroke="#9b9b9b" stroke-width="1"/>
<!-- page content lines -->
<rect x="10" y="34" width="80" height="6" rx="2" fill="#e0e0e0"/>
<rect x="10" y="46" width="58" height="6" rx="2" fill="#e0e0e0"/>
<rect x="10" y="58" width="68" height="6" rx="2" fill="#e0e0e0"/>
<rect x="10" y="70" width="48" height="6" rx="2" fill="#e0e0e0"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "client", 100, 120,
    ),

    # ── Router ────────────────────────────────────────────────────────────────
    (
        "router",
        ["router", "wifi", "gateway", "access point", "ap"],
        """\
<!-- antennas (3, evenly spaced) -->
<line x1="26" y1="30" x2="18" y2="8"  stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>
<line x1="50" y1="30" x2="50" y2="5"  stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>
<line x1="74" y1="30" x2="82" y2="8"  stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>
<circle cx="18" cy="7"  r="3" fill="{stroke}"/>
<circle cx="50" cy="4"  r="3" fill="{stroke}"/>
<circle cx="82" cy="7"  r="3" fill="{stroke}"/>
<!-- body -->
<rect x="6" y="30" width="88" height="52" rx="7" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- status LEDs -->
<circle cx="20" cy="48" r="4" fill="#2f9e44"/>
<circle cx="32" cy="48" r="4" fill="#e67700"/>
<circle cx="44" cy="48" r="4" fill="#2f9e44"/>
<!-- ethernet port slot -->
<rect x="56" y="58" width="32" height="12" rx="2" fill="white" stroke="{stroke}" stroke-width="1"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "network", 100, 120,
    ),

    # ── Server ────────────────────────────────────────────────────────────────
    (
        "server",
        ["server", "backend", "web server", "app server", "host"],
        """\
<!-- rack enclosure -->
<rect x="14" y="4" width="72" height="88" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- rack unit dividers -->
<line x1="14" y1="32" x2="86" y2="32" stroke="{stroke}" stroke-width="1"/>
<line x1="14" y1="60" x2="86" y2="60" stroke="{stroke}" stroke-width="1"/>
<!-- unit 1: drive bay + LED -->
<rect x="20" y="10" width="38" height="16" rx="2" fill="#d4d4d4" stroke="{stroke}" stroke-width="1"/>
<circle cx="74" cy="18" r="4" fill="#2f9e44"/>
<!-- unit 2: drive bay + LED -->
<rect x="20" y="38" width="38" height="16" rx="2" fill="#d4d4d4" stroke="{stroke}" stroke-width="1"/>
<circle cx="74" cy="46" r="4" fill="#2f9e44"/>
<!-- unit 3: drive bay + LED -->
<rect x="20" y="66" width="38" height="16" rx="2" fill="#d4d4d4" stroke="{stroke}" stroke-width="1"/>
<circle cx="74" cy="74" r="4" fill="#e67700"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "compute", 100, 120,
    ),

    # ── Database ──────────────────────────────────────────────────────────────
    (
        "database",
        ["database", "db", "sql", "postgres", "mysql", "mongodb", "redis", "storage"],
        """\
<!-- cylinder: top cap -->
<ellipse cx="50" cy="18" rx="34" ry="12" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- cylinder body -->
<rect x="16" y="18" width="68" height="56" fill="{fill}" stroke="none"/>
<line x1="16" y1="18" x2="16" y2="74" stroke="{stroke}" stroke-width="1.5"/>
<line x1="84" y1="18" x2="84" y2="74" stroke="{stroke}" stroke-width="1.5"/>
<!-- shelf rings -->
<ellipse cx="50" cy="38" rx="34" ry="12" fill="none" stroke="{stroke}" stroke-width="1" stroke-dasharray="4,3"/>
<ellipse cx="50" cy="58" rx="34" ry="12" fill="none" stroke="{stroke}" stroke-width="1" stroke-dasharray="4,3"/>
<!-- bottom cap -->
<ellipse cx="50" cy="74" rx="34" ry="12" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "storage", 100, 120,
    ),

    # ── Computer / Laptop ─────────────────────────────────────────────────────
    (
        "computer",
        ["computer", "laptop", "pc", "workstation", "desktop", "client"],
        """\
<!-- monitor frame -->
<rect x="8" y="4" width="84" height="62" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- screen -->
<rect x="14" y="10" width="72" height="48" rx="2" fill="white" stroke="{stroke}" stroke-width="1"/>
<!-- screen content lines -->
<rect x="20" y="18" width="60" height="5" rx="2" fill="#e0e0e0"/>
<rect x="20" y="28" width="44" height="5" rx="2" fill="#e0e0e0"/>
<rect x="20" y="38" width="52" height="5" rx="2" fill="#e0e0e0"/>
<!-- stand neck -->
<rect x="43" y="66" width="14" height="10" fill="{stroke}"/>
<!-- base -->
<rect x="22" y="76" width="56" height="10" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "client", 100, 120,
    ),

    # ── Phone / Mobile ────────────────────────────────────────────────────────
    (
        "phone",
        ["phone", "mobile", "smartphone", "device", "iphone", "android"],
        """\
<!-- phone body -->
<rect x="22" y="2" width="56" height="90" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- camera pill notch -->
<rect x="34" y="8" width="20" height="6" rx="3" fill="{stroke}" opacity="0.5"/>
<!-- screen -->
<rect x="27" y="20" width="46" height="60" rx="3" fill="white" stroke="{stroke}" stroke-width="1"/>
<!-- screen content lines -->
<rect x="33" y="28" width="34" height="5" rx="2" fill="#e0e0e0"/>
<rect x="33" y="38" width="24" height="5" rx="2" fill="#e0e0e0"/>
<rect x="33" y="48" width="30" height="5" rx="2" fill="#e0e0e0"/>
<!-- home bar -->
<rect x="38" y="83" width="24" height="4" rx="2" fill="{stroke}" opacity="0.4"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "client", 100, 120,
    ),

    # ── Cloud ─────────────────────────────────────────────────────────────────
    (
        "cloud",
        ["cloud", "aws", "azure", "gcp", "cloud storage", "cloud service"],
        """\
<!-- cloud fill circles -->
<circle cx="28" cy="60" r="22" fill="{fill}"/>
<circle cx="50" cy="46" r="28" fill="{fill}"/>
<circle cx="72" cy="52" r="22" fill="{fill}"/>
<circle cx="86" cy="62" r="16" fill="{fill}"/>
<circle cx="14" cy="62" r="14" fill="{fill}"/>
<!-- flat base rect -->
<rect x="14" y="62" width="72" height="20" fill="{fill}"/>
<!-- cloud outline -->
<path d="M14 82 L14 66 Q8 52 28 42 Q32 18 50 18 Q66 12 76 30 Q88 30 92 50 Q100 56 100 66 L100 82 Z"
      fill="none" stroke="{stroke}" stroke-width="1.5" stroke-linejoin="round"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "cloud", 100, 120,
    ),

    # ── Internet / Globe ──────────────────────────────────────────────────────
    (
        "internet",
        ["internet", "globe", "world", "web", "www", "network"],
        """\
<!-- globe circle -->
<circle cx="50" cy="48" r="40" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- equator ellipse -->
<ellipse cx="50" cy="48" rx="40" ry="14" fill="none" stroke="{stroke}" stroke-width="1" stroke-dasharray="4,3"/>
<!-- prime meridian -->
<line x1="50" y1="8" x2="50" y2="88" stroke="{stroke}" stroke-width="1"/>
<!-- longitude arcs -->
<path d="M50 8 Q22 48 50 88" fill="none" stroke="{stroke}" stroke-width="1" stroke-dasharray="4,3"/>
<path d="M50 8 Q78 48 50 88" fill="none" stroke="{stroke}" stroke-width="1" stroke-dasharray="4,3"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "cloud", 100, 120,
    ),

    # ── User / Person ─────────────────────────────────────────────────────────
    (
        "user",
        ["user", "person", "human", "actor", "customer", "student"],
        """\
<!-- head -->
<circle cx="50" cy="22" r="16" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- torso -->
<line x1="50" y1="38" x2="50" y2="72" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<!-- arms -->
<line x1="50" y1="52" x2="28" y2="66" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="50" y1="52" x2="72" y2="66" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<!-- legs -->
<line x1="50" y1="72" x2="36" y2="92" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="50" y1="72" x2="64" y2="92" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "actor", 100, 120,
    ),

    # ── Firewall ──────────────────────────────────────────────────────────────
    (
        "firewall",
        ["firewall", "security", "waf", "ids", "ips"],
        """\
<!-- body -->
<rect x="6" y="4" width="88" height="80" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- shield -->
<path d="M50 14 L70 22 L70 48 Q70 64 50 72 Q30 64 30 48 L30 22 Z"
      fill="#ffd0d0" stroke="{stroke}" stroke-width="1.5"/>
<!-- X mark (deny) -->
<line x1="41" y1="36" x2="59" y2="56" stroke="#e03131" stroke-width="2.5" stroke-linecap="round"/>
<line x1="59" y1="36" x2="41" y2="56" stroke="#e03131" stroke-width="2.5" stroke-linecap="round"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "security", 100, 120,
    ),

    # ── ISP ───────────────────────────────────────────────────────────────────
    (
        "isp",
        ["isp", "provider", "telecom", "carrier"],
        """\
<!-- body -->
<rect x="6" y="8" width="88" height="68" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- left signal arcs -->
<path d="M26 42 Q32 32 40 42" fill="none" stroke="{stroke}" stroke-width="2"   stroke-linecap="round"/>
<path d="M20 42 Q29 26 40 42" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-linecap="round"/>
<path d="M14 42 Q26 20 40 42" fill="none" stroke="{stroke}" stroke-width="1"   stroke-linecap="round" stroke-dasharray="3,3"/>
<!-- centre dots + link -->
<circle cx="40" cy="42" r="4" fill="{stroke}"/>
<line x1="40" y1="42" x2="60" y2="42" stroke="{stroke}" stroke-width="1.5"/>
<circle cx="60" cy="42" r="4" fill="{stroke}"/>
<!-- right signal arcs -->
<path d="M60 42 Q68 32 74 42" fill="none" stroke="{stroke}" stroke-width="2"   stroke-linecap="round"/>
<path d="M60 42 Q71 26 80 42" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-linecap="round"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "network", 100, 120,
    ),

    # ── Load Balancer ─────────────────────────────────────────────────────────
    (
        "load_balancer",
        ["load balancer", "lb", "nginx", "haproxy", "proxy"],
        """\
<!-- LB core box -->
<rect x="6" y="28" width="38" height="38" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<text x="25" y="47" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="{stroke}">LB</text>
<!-- fan-out lines to 3 targets -->
<line x1="44" y1="47" x2="62" y2="22" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="44" y1="47" x2="62" y2="47" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="44" y1="47" x2="62" y2="72" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<!-- target rects -->
<rect x="64" y="14" width="28" height="16" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1"/>
<rect x="64" y="39" width="28" height="16" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1"/>
<rect x="64" y="64" width="28" height="16" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "network", 100, 120,
    ),

    # ── DNS ───────────────────────────────────────────────────────────────────
    (
        "dns",
        ["dns", "name server", "resolver", "nameserver"],
        """\
<!-- body -->
<rect x="6" y="8" width="88" height="68" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- domain name -->
<text x="50" y="28" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="{stroke}">example.com</text>
<!-- arrow down -->
<line x1="50" y1="36" x2="50" y2="50" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<!-- IP address -->
<text x="50" y="62" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="{stroke}">93.184.216.34</text>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "infra", 100, 120,
    ),

    # ── API / Microservice ────────────────────────────────────────────────────
    (
        "api",
        ["api", "microservice", "service", "endpoint", "rest", "graphql"],
        """\
<!-- body -->
<rect x="6" y="14" width="88" height="62" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- { } braces -->
<text x="50" y="46" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="700" fill="{stroke}">&#123;&#125;</text>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "service", 100, 120,
    ),

    # ── Cache ─────────────────────────────────────────────────────────────────
    (
        "cache",
        ["cache", "redis cache", "memcache", "cdn cache"],
        """\
<!-- body -->
<rect x="6" y="14" width="88" height="62" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>
<!-- lightning bolt -->
<path d="M56 18 L40 46 L50 46 L44 72 L64 40 L54 40 Z"
      fill="#febc2e" stroke="{stroke}" stroke-width="1" stroke-linejoin="round"/>
<!-- label -->
<text x="50" y="108" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="600" fill="{stroke}">{label}</text>""",
        "storage", 100, 120,
    ),

]

# ─────────────────────────────────────────────────────────────────────────────
# Seed runner
# ─────────────────────────────────────────────────────────────────────────────

def seed(force: bool = False) -> None:
    if not os.path.exists(os.path.dirname(DB_PATH)):
        print(f"ERROR: DB directory not found: {os.path.dirname(DB_PATH)}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
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

    inserted = 0
    updated  = 0
    skipped  = 0

    for name, keywords, svg_template, category, width, height in COMPONENTS:
        exists = conn.execute(
            "SELECT id FROM svg_components WHERE name = ?", (name,)
        ).fetchone()

        if exists and force:
            conn.execute(
                """UPDATE svg_components
                   SET keywords=?, svg_template=?, category=?, width=?, height=?
                   WHERE name=?""",
                (json.dumps(keywords), svg_template, category, width, height, name),
            )
            updated += 1
        elif exists:
            skipped += 1
        else:
            conn.execute(
                """INSERT INTO svg_components (name, keywords, svg_template, category, width, height)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (name, json.dumps(keywords), svg_template, category, width, height),
            )
            inserted += 1

    conn.commit()
    conn.close()

    print(f"database.sqlite — svg_components seeded:")
    print(f"  inserted : {inserted}")
    print(f"  updated  : {updated}  {'(--force)' if force else ''}")
    print(f"  skipped  : {skipped}  (already exist)")
    print(f"  total    : {inserted + updated + skipped} components")


if __name__ == "__main__":
    force = "--force" in sys.argv
    seed(force=force)
