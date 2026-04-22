// ─── Zenith Design Tokens ─────────────────────────────────────────────────────
// Single source of truth for all design values.
// Change a value here and it propagates to the MUI theme, CSS custom properties,
// and every component that imports from this file.

// ─── Brand ────────────────────────────────────────────────────────────────────
export const BRAND = {
  primary:     '#1847D6',  // Zenith Blue — CTAs, active states, key brand moments
  accent:      '#4B72FF',  // Zenith Blue Light — dark-mode primary, tinted surfaces
  gradient:    'linear-gradient(135deg, #1847D6 0%, #6B44F8 100%)',
  gradientAlt: 'linear-gradient(135deg, #4B72FF 0%, #6B44F8 100%)',
  gradientHover: 'linear-gradient(135deg, #1340C0 0%, #5C38D9 100%)',
}

// ─── Palette ──────────────────────────────────────────────────────────────────
export const PALETTE = {
  // Dark backgrounds
  nearBlack:       '#111111',  // primary dark page background
  darkSurface:     '#1c1c1c',  // card / paper on dark
  darkSubsurface:  '#262626',  // elevated surfaces on dark
  sidebarDark:     '#0f0f0f',  // sidebar / nav on dark

  // Light backgrounds
  parchment:       '#f8fafc',  // primary light page background
  ivory:           '#ffffff',  // card / paper on light
  warmSand:        '#f1f5f9',  // button backgrounds, interactive surfaces
  sidebarLight:    '#f1f5f9',  // sidebar / nav on light

  // Text
  nearBlackText:   '#0f172a',  // primary text on light
  oliveGray:       '#64748b',  // secondary text on light
  stoneGray:       '#94a3b8',  // tertiary text, disabled, metadata
  charcoalWarm:    '#475569',  // button text on surfaces
  warmSilver:      '#f1f5f9',  // primary text on dark
  darkWarm:        '#334155',  // emphasized secondary text

  // Borders & dividers
  borderCream:     '#e2e8f0',  // standard light border
  borderWarm:      '#e2e8f0',  // prominent light border
  borderDark:      '#1e293b',  // standard dark border
  dividerLight:    '#e2e8f0',
  dividerDark:     '#1e293b',

  // Semantic
  errorRed:        '#b53333',  // warm error — serious without alarming
  focusBlue:       '#3898ec',  // a11y focus ring ONLY — the one cool color
  successGreen:    '#22c55e',  // ready / success states
  warningOrange:   '#fb923c',  // in-progress / warning states
  starGold:        '#f59e0b',  // starred / favorited items

  // Fixed — not mode-responsive
  loginPanelBg:    '#0d0d1a',  // login left panel (always dark)
  pureWhite:       '#ffffff',  // max-contrast elements only
}

// ─── Typography ───────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',

  weights: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  // px values — use as reference; apply via theme or rem in CSS
  sizes: {
    micro:     9.6,
    overline:  10,
    label:     12,
    caption:   13,
    bodyXs:    13,
    bodySm:    14,
    body:      15,
    bodyLg:    16,
    subheadSm: 17,
    subhead:   20,
    heading:   24,
    headingLg: 32,
    display:   48,
    hero:      64,
  },

  lineHeights: {
    tight:   1.1,
    snug:    1.3,
    normal:  1.5,
    relaxed: 1.6,
    loose:   1.7,
  },

  letterSpacing: {
    tighter: '-0.03em',
    tight:   '-0.01em',
    normal:  '0em',
    wide:    '0.04em',
    wider:   '0.07em',
    widest:  '0.12em',
  },
}

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Base unit: 8px. Use multiples of this wherever possible.
export const SPACING = {
  unit: 8,
  xxs:  3,
  xs:   4,
  sm:   6,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  24,
  xxxl: 32,
  huge: 48,
  max:  64,
}

// ─── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  none:  0,
  sharp: 4,   // minimal inline elements
  sm:    6,   // small buttons, secondary elements
  md:    8,   // standard buttons, cards, containers
  lg:    12,  // primary buttons, inputs, nav elements
  xl:    16,  // featured containers, video players
  xxl:   24,  // tag-like, highlighted containers
  full:  32,  // hero containers, large cards
  pill:  9999, // fully rounded pills
}

// ─── Shadows ──────────────────────────────────────────────────────────────────
// Ring-based system — depth through warm-toned halos, not heavy drop shadows
export const SHADOWS = {
  // Ring shadows — primary interaction feedback
  ringNeutral: '0px 0px 0px 1px #d1cfc5',
  ringBrand:   '0px 0px 0px 1px #1847D6',
  ringDark:    '0px 0px 0px 1px #30302e',

  // Elevation
  whisper: 'rgba(0,0,0,0.05) 0px 4px 24px',   // cards on light
  card:    'rgba(0,0,0,0.08) 0px 2px 12px',   // slightly elevated
  overlay: 'rgba(0,0,0,0.15) 0px 8px 24px',   // modals, popovers
  dark:    'rgba(0,0,0,0.50) 0px 8px 32px',   // dark theme overlays

  // Brand glow — for primary CTA hover states
  brandGlow: '0 4px 16px rgba(24, 71, 214, 0.40)',
}

// ─── Transitions ──────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  fast:   '0.12s ease',
  normal: '0.18s ease',
  slow:   '0.28s cubic-bezier(0.4, 0, 0.2, 1)',
}
