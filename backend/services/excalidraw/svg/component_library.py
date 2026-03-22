"""
Pre-built SVG component library for common educational / tech diagram entities.

Each icon is a <g> element drawn at the origin (top-left = 0,0) within a
fixed bounding box.  Callers position it by wrapping in:

    <g transform="translate(X, Y)">
        {component.svg}
    </g>

Templates use three placeholders substituted at generation time:
    {fill}   — primary fill color from shared_style.backgroundColor
    {stroke} — stroke color from shared_style.strokeColor
    {label}  — entity display name extracted from element_vocabulary

To add a new icon: add an entry to ICON_LIBRARY with a list of keyword
aliases that the entity-key matcher uses.
"""

from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class SVGComponent:
    """A single pre-built SVG icon."""
    svg: str        # raw <g>...</g> markup (no surrounding <g>, just the children)
    width: int      # bounding-box width  (pixels)
    height: int     # bounding-box height (pixels)


# ---------------------------------------------------------------------------
# Icon definitions
# ---------------------------------------------------------------------------
# Each entry: (keywords, width, height, svg_template)
#   keywords — lower-case strings; entity key is matched if ANY keyword is a
#              substring of the key (e.g. "browser" matches "web_browser")
#   svg_template — use {fill}, {stroke}, {label} as substitution slots.
#                  Elements must be in painter's order (shapes before their text).

_ICONS: list[tuple[list[str], int, int, str]] = [

    # ── Browser ──────────────────────────────────────────────────────────────
    (
        ["browser", "chrome", "firefox", "web client", "client app"],
        180, 120,
        """<!-- Browser frame -->
<rect x="0" y="0" width="180" height="120" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- Toolbar -->
<rect x="0" y="0" width="180" height="24" fill="{stroke}" rx="6"/>
<rect x="0" y="18" width="180" height="6" fill="{stroke}"/>
<!-- Traffic-light buttons -->
<circle cx="14" cy="12" r="5" fill="#ff5f57"/>
<circle cx="28" cy="12" r="5" fill="#febc2e"/>
<circle cx="42" cy="12" r="5" fill="#28c840"/>
<!-- Address bar -->
<rect x="54" y="5" width="112" height="14" fill="white" stroke="#888888" stroke-width="1" rx="3"/>
<!-- Page content lines (simulated text blocks) -->
<rect x="12" y="34" width="156" height="7" fill="#d8d8d8" rx="2"/>
<rect x="12" y="47" width="110" height="7" fill="#d8d8d8" rx="2"/>
<rect x="12" y="60" width="130" height="7" fill="#d8d8d8" rx="2"/>
<!-- Label -->
<text x="90" y="98" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Router ───────────────────────────────────────────────────────────────
    (
        ["router", "wifi", "gateway", "access point", "ap"],
        130, 110,
        """<!-- Antennas -->
<line x1="35" y1="32" x2="24" y2="7" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="65" y1="32" x2="65" y2="4" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="95" y1="32" x2="106" y2="7" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="24" cy="5" r="4" fill="{stroke}"/>
<circle cx="65" cy="2" r="4" fill="{stroke}"/>
<circle cx="106" cy="5" r="4" fill="{stroke}"/>
<!-- Body -->
<rect x="6" y="32" width="118" height="60" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="8"/>
<!-- LED indicators -->
<circle cx="25" cy="52" r="5" fill="#2f9e44"/>
<circle cx="40" cy="52" r="5" fill="#e67700"/>
<circle cx="55" cy="52" r="5" fill="#2f9e44"/>
<!-- Port slot -->
<rect x="68" y="62" width="42" height="14" fill="white" stroke="{stroke}" stroke-width="1" rx="2"/>
<!-- Label -->
<text x="65" y="83" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Server ───────────────────────────────────────────────────────────────
    (
        ["server", "backend", "web server", "app server", "host"],
        110, 160,
        """<!-- Rack enclosure -->
<rect x="8" y="0" width="94" height="160" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="4"/>
<!-- Rack unit dividers -->
<line x1="8" y1="38" x2="102" y2="38" stroke="{stroke}" stroke-width="1"/>
<line x1="8" y1="76" x2="102" y2="76" stroke="{stroke}" stroke-width="1"/>
<line x1="8" y1="114" x2="102" y2="114" stroke="{stroke}" stroke-width="1"/>
<!-- Unit 1: drive bay + LED -->
<rect x="16" y="10" width="48" height="20" fill="#c8c8c8" stroke="{stroke}" stroke-width="1" rx="2"/>
<circle cx="90" cy="20" r="5" fill="#2f9e44"/>
<!-- Unit 2: drive bay + LED -->
<rect x="16" y="48" width="48" height="20" fill="#c8c8c8" stroke="{stroke}" stroke-width="1" rx="2"/>
<circle cx="90" cy="58" r="5" fill="#2f9e44"/>
<!-- Unit 3: drive bay + LED -->
<rect x="16" y="86" width="48" height="20" fill="#c8c8c8" stroke="{stroke}" stroke-width="1" rx="2"/>
<circle cx="90" cy="96" r="5" fill="#e67700"/>
<!-- Label -->
<text x="55" y="140" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Database ─────────────────────────────────────────────────────────────
    (
        ["database", "db", "sql", "postgres", "mysql", "mongodb", "redis", "storage"],
        110, 140,
        """<!-- Top ellipse (back) -->
<ellipse cx="55" cy="22" rx="47" ry="17" fill="{fill}" stroke="{stroke}" stroke-width="2"/>
<!-- Cylinder body (sides only — no top/bottom stroke so ellipses control those) -->
<rect x="8" y="22" width="94" height="90" fill="{fill}" stroke="none"/>
<line x1="8" y1="22" x2="8" y2="112" stroke="{stroke}" stroke-width="2"/>
<line x1="102" y1="22" x2="102" y2="112" stroke="{stroke}" stroke-width="2"/>
<!-- Platter separator rings -->
<ellipse cx="55" cy="52" rx="47" ry="17" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5,3"/>
<ellipse cx="55" cy="82" rx="47" ry="17" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5,3"/>
<!-- Bottom ellipse (front) -->
<ellipse cx="55" cy="112" rx="47" ry="17" fill="{fill}" stroke="{stroke}" stroke-width="2"/>
<!-- Label (drawn last — on top of everything) -->
<text x="55" y="67" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Computer / Laptop ────────────────────────────────────────────────────
    (
        ["computer", "laptop", "pc", "workstation", "desktop", "client"],
        160, 130,
        """<!-- Monitor outer frame -->
<rect x="10" y="0" width="140" height="90" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="5"/>
<!-- Screen (inner white display area) -->
<rect x="18" y="8" width="124" height="68" fill="white" stroke="{stroke}" stroke-width="1" rx="2"/>
<!-- Screen content lines -->
<rect x="26" y="18" width="100" height="7" fill="#d8d8d8" rx="2"/>
<rect x="26" y="31" width="76" height="7" fill="#d8d8d8" rx="2"/>
<rect x="26" y="44" width="88" height="7" fill="#d8d8d8" rx="2"/>
<!-- Monitor stand -->
<rect x="68" y="90" width="24" height="12" fill="{stroke}" rx="0"/>
<!-- Base / keyboard -->
<rect x="20" y="102" width="120" height="16" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="4"/>
<!-- Keyboard key rows -->
<line x1="30" y1="108" x2="130" y2="108" stroke="{stroke}" stroke-width="0.8"/>
<!-- Label -->
<text x="80" y="124" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Phone / Mobile ───────────────────────────────────────────────────────
    (
        ["phone", "mobile", "smartphone", "device", "iphone", "android"],
        80, 145,
        """<!-- Phone body -->
<rect x="5" y="0" width="70" height="145" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="12"/>
<!-- Camera notch -->
<rect x="28" y="8" width="24" height="7" fill="{stroke}" rx="3"/>
<circle cx="46" cy="11" r="3" fill="#1971c2"/>
<!-- Screen area -->
<rect x="10" y="22" width="60" height="92" fill="white" stroke="{stroke}" stroke-width="1" rx="4"/>
<!-- Screen content lines -->
<rect x="16" y="32" width="48" height="6" fill="#d8d8d8" rx="2"/>
<rect x="16" y="44" width="36" height="6" fill="#d8d8d8" rx="2"/>
<!-- Home bar -->
<rect x="25" y="130" width="30" height="5" fill="{stroke}" rx="3"/>
<!-- Label -->
<text x="40" y="70" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Cloud (internet / storage cloud) ────────────────────────────────────
    (
        ["cloud", "aws", "azure", "gcp", "cloud storage", "cloud service"],
        190, 120,
        """<!-- Cloud fill: overlapping circles (no individual stroke) -->
<circle cx="52" cy="70" r="30" fill="{fill}"/>
<circle cx="86" cy="55" r="36" fill="{fill}"/>
<circle cx="124" cy="58" r="33" fill="{fill}"/>
<circle cx="155" cy="70" r="26" fill="{fill}"/>
<!-- Base rect to fill in the bottom of the cloud -->
<rect x="22" y="75" width="157" height="30" fill="{fill}"/>
<!-- Cloud outline path (approximate contour of the circles above) -->
<path d="M 22 105 L 22 80 Q 22 40 52 40 Q 58 18 86 19 Q 96 4 124 25 Q 140 20 155 44 Q 175 52 181 75 L 181 105 Z"
      fill="none" stroke="{stroke}" stroke-width="2" stroke-linejoin="round"/>
<!-- Label -->
<text x="95" y="88" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Internet / Globe ────────────────────────────────────────────────────
    (
        ["internet", "globe", "world", "web", "www", "network"],
        140, 155,
        """<!-- Globe circle -->
<circle cx="70" cy="70" r="58" fill="{fill}" stroke="{stroke}" stroke-width="2"/>
<!-- Equator ellipse -->
<ellipse cx="70" cy="70" rx="58" ry="20" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5,3"/>
<!-- Vertical center meridian -->
<line x1="70" y1="12" x2="70" y2="128" stroke="{stroke}" stroke-width="1.5"/>
<!-- Left longitude arc -->
<path d="M 70 12 Q 30 70 70 128" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5,3"/>
<!-- Right longitude arc -->
<path d="M 70 12 Q 110 70 70 128" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5,3"/>
<!-- Label below globe -->
<text x="70" y="146" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── User / Person ────────────────────────────────────────────────────────
    (
        ["user", "person", "human", "client", "actor", "customer", "student"],
        70, 145,
        """<!-- Head -->
<circle cx="35" cy="22" r="18" fill="{fill}" stroke="{stroke}" stroke-width="2"/>
<!-- Neck + body line -->
<line x1="35" y1="40" x2="35" y2="90" stroke="{stroke}" stroke-width="3" stroke-linecap="round"/>
<!-- Arms -->
<line x1="35" y1="58" x2="10" y2="78" stroke="{stroke}" stroke-width="3" stroke-linecap="round"/>
<line x1="35" y1="58" x2="60" y2="78" stroke="{stroke}" stroke-width="3" stroke-linecap="round"/>
<!-- Legs -->
<line x1="35" y1="90" x2="18" y2="120" stroke="{stroke}" stroke-width="3" stroke-linecap="round"/>
<line x1="35" y1="90" x2="52" y2="120" stroke="{stroke}" stroke-width="3" stroke-linecap="round"/>
<!-- Label -->
<text x="35" y="138" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Firewall ─────────────────────────────────────────────────────────────
    (
        ["firewall", "security", "waf", "ids", "ips"],
        120, 110,
        """<!-- Firewall body -->
<rect x="5" y="0" width="110" height="90" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- Shield icon (drawn inside the body) -->
<path d="M 60 15 L 82 24 L 82 48 Q 82 65 60 75 Q 38 65 38 48 L 38 24 Z"
      fill="#ffc9c9" stroke="{stroke}" stroke-width="1.5"/>
<!-- Shield check mark -->
<polyline points="50,48 57,56 72,38" fill="none" stroke="#e03131" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<!-- Label -->
<text x="60" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── ISP ──────────────────────────────────────────────────────────────────
    (
        ["isp", "provider", "telecom", "carrier"],
        130, 110,
        """<!-- ISP body -->
<rect x="5" y="0" width="120" height="85" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- Signal wave arcs (representing transmission) -->
<path d="M 30 42 Q 42 28 54 42" fill="none" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 20 42 Q 37 18 54 42" fill="none" stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>
<path d="M 10 42 Q 32 8 54 42" fill="none" stroke="{stroke}" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4,3"/>
<!-- Transmission dot -->
<circle cx="54" cy="42" r="5" fill="{stroke}"/>
<!-- Right side: outgoing signal -->
<path d="M 76 42 Q 88 28 100 42" fill="none" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 76 42 Q 93 18 110 42" fill="none" stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>
<!-- Label -->
<text x="65" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Load Balancer ────────────────────────────────────────────────────────
    (
        ["load balancer", "lb", "nginx", "haproxy", "proxy"],
        130, 110,
        """<!-- LB body -->
<rect x="5" y="30" width="50" height="50" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<text x="30" y="55" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="{stroke}">LB</text>
<!-- Input arrow -->
<line x1="0" y1="55" x2="4" y2="55" stroke="{stroke}" stroke-width="2"/>
<!-- Output arrows fanning out to 3 servers -->
<line x1="55" y1="55" x2="90" y2="25" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="55" y1="55" x2="90" y2="55" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<line x1="55" y1="55" x2="90" y2="85" stroke="{stroke}" stroke-width="1.5" marker-end="url(#arrow)"/>
<!-- Server targets (small rects) -->
<rect x="92" y="16" width="32" height="18" fill="{fill}" stroke="{stroke}" stroke-width="1.5" rx="3"/>
<rect x="92" y="46" width="32" height="18" fill="{fill}" stroke="{stroke}" stroke-width="1.5" rx="3"/>
<rect x="92" y="76" width="32" height="18" fill="{fill}" stroke="{stroke}" stroke-width="1.5" rx="3"/>
<!-- Label -->
<text x="65" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── DNS ──────────────────────────────────────────────────────────────────
    (
        ["dns", "name server", "resolver", "nameserver"],
        120, 100,
        """<!-- DNS body -->
<rect x="5" y="0" width="110" height="80" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- DNS symbol: domain name arrow to IP -->
<text x="60" y="28" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="{stroke}">example.com</text>
<line x1="30" y1="40" x2="90" y2="40" stroke="{stroke}" stroke-width="2" marker-end="url(#arrow)"/>
<text x="60" y="58" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="{stroke}">93.184.216.34</text>
<!-- Label -->
<text x="60" y="90" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── API / Microservice ───────────────────────────────────────────────────
    (
        ["api", "microservice", "service", "endpoint", "rest", "graphql"],
        120, 90,
        """<!-- API body -->
<rect x="5" y="0" width="110" height="70" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- Curly brace icon -->
<text x="60" y="32" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="bold" fill="{stroke}">&#123; &#125;</text>
<!-- Label -->
<text x="60" y="82" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

    # ── Cache ────────────────────────────────────────────────────────────────
    (
        ["cache", "redis cache", "memcache", "cdn cache"],
        120, 90,
        """<!-- Cache body -->
<rect x="5" y="0" width="110" height="70" fill="{fill}" stroke="{stroke}" stroke-width="2" rx="6"/>
<!-- Lightning bolt (speed icon) -->
<polygon points="68,10 52,38 63,38 52,62 76,30 64,30 76,10" fill="#febc2e" stroke="{stroke}" stroke-width="1.5" stroke-linejoin="round"/>
<!-- Label -->
<text x="60" y="82" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="{stroke}">{label}</text>"""
    ),

]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _extract_label(spec: str, key: str) -> str:
    """Extract the label text from an element_vocabulary spec string."""
    import re
    m = re.search(r"label\s+'([^']+)'", spec, re.IGNORECASE)
    if m:
        return m.group(1)
    # Fall back: prettify the entity key
    return key.replace("_", " ").title()


def get_builtin_component(
    key: str,
    spec: str,
    fill: str,
    stroke: str,
) -> Optional[SVGComponent]:
    """
    Return a pre-built SVGComponent for the given entity key, or None if
    no built-in icon matches.

    Matching is done by checking whether any keyword from an icon entry is
    a substring of the (lower-cased) entity key.
    """
    key_lower = key.lower().replace("_", " ")
    label = _extract_label(spec, key)

    for keywords, width, height, template in _ICONS:
        if any(kw in key_lower for kw in keywords):
            svg = (
                template
                .replace("{fill}", fill)
                .replace("{stroke}", stroke)
                .replace("{label}", label)
            )
            return SVGComponent(svg=svg, width=width, height=height)

    return None
