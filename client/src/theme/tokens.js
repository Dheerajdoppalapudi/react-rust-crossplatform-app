// ─── Zenith Design Tokens ─────────────────────────────────────────────────────
// Single source of truth for all design values.
// Change a value here and it propagates to the MUI theme, CSS custom properties,
// and every component that imports from this file.
//
// Cleaned: the three overlapping semantic-color systems are unified into SEMANTIC,
// and duplicate border/divider names are collapsed. The DEPRECATED block at the
// bottom keeps old call sites compiling until the migration removes them.

// ─── Brand ────────────────────────────────────────────────────────────────────
export const BRAND = {
  primary: '#0E7C66',  // Pine — send button + prompt focus border (light mode)
  hover:   '#0A6353',  // deeper — hover state
  press:   '#084C40',  // deepest — pressed / active
  soft:    '#DCEDE8',  // tinted surface fill (selection, soft badges) on light
  glow:    '#2FD4B5',  // bright — dark-mode primary + active indicators

  accent:  '#2FD4B5',  // == glow; alias for existing dark-mode call sites

}

// ─── Semantic ─────────────────────────────────────────────────────────────────
// ONE matte semantic system for the whole app (status, quiz feedback, alerts).
// Mid-tone fills: great for badges/borders/icons/buttons. For small text on light
// backgrounds use the *Text variants (better contrast).
export const SEMANTIC = {
  success:     '#4F8A5B',  // muted sage-green (distinct from Pine teal)
  successText: '#3B6B45',  // darker, for success text on light backgrounds
  danger:      '#C0473B',  // warm brick red
  dangerText:  '#9A372D',
  warning:     '#C0883E',  // muted ochre
  warningText: '#956726',
  info:        '#3E6B8A',  // muted steel-blue
  infoText:    '#2F526B',
  link:        '#2563eb',  // light mode link text (research citations, markdown anchors)
  linkDark:    '#7b9fff',  // dark mode link text
}

// ─── Palette ──────────────────────────────────────────────────────────────────
// Neutrals are cool slate (despite the warm-sounding names) — they pair with Pine,
// so they were left unchanged in the migration.
export const PALETTE = {
  // Dark backgrounds
  nearBlack:       '#0f1110',  // primary dark page background
  darkSurface:     '#1a1c1b',  // card / paper on dark
  darkSubsurface:  '#232624',  // elevated surfaces on dark
  sidebarDark:     '#0f0f0f',  // sidebar / nav on dark

  // Light backgrounds
  parchment:       '#f7f9f8',  // primary light page background
  ivory:           '#fafcfb',  // card / paper on light
  warmSand:        '#eff3f1',  // button backgrounds, interactive surfaces, sidebar
  sidebarLight:    '#f1f5f9',  // (== warmSand; kept as a distinct role name)

  // Text
  nearBlackText:   '#071510',  // primary text on light
  oliveGray:       '#7c837f',  // secondary text on light
  stoneGray:       '#808583',  // tertiary text, disabled, metadata
  charcoalWarm:    '#5e746d',  // neutral button text / neutral action color
  warmSilver:      '#f2f4f3',  // primary text on dark
  darkWarm:        '#9bb3ab',  // emphasized secondary text

  // Borders & dividers — collapsed to two canonical values
  border:          '#e2e8f0',  // light mode border + divider
  borderDark:      '#2a2a2a',  // dark mode border + divider — neutral, no blue tint

  // Accent (non-status)
  focusBlue:       '#3898ec',  // a11y focus ring ONLY — intentionally cool; fine with Pine
  starGold:        '#f59e0b',  // starred / favorited items

  // Fixed — not mode-responsive
  loginPanelBg:    '#0d0d1a',  // login left panel (always dark)
  pureWhite:       '#ffffff',  // max-contrast elements only
  pureBlack:       '#000000',  // video/media player backgrounds only
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
  // Target scale (6 tiers): 10 · 12 · 13 · 14–15 · 17 · 24
  // Avoid half-pixel sizes (12.5, 13.5, 11.5) — use the nearest whole value.
  sizes: {
    micro:     9.6,
    overline:  10,
    label:     12,
    caption:   13,
    // bodyXs: 13 — DEPRECATED, identical to caption; use caption instead
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
  sharp: 3,
  sm:    4,   // login fields, small badges
  md:    6,   // theme.shape.borderRadius — MUI default multiplier base
  ui:    7,   // nav items, icon buttons, sidebar rows, toolbar buttons
  lg:    8,   // cards, conversation items, larger interactive surfaces
  xl:    12,  // menus, prompt bar card, modals
  xxl:   16,  // dialogs, rename modals
  full:  24,  // pill buttons, chips, avatar-adjacent elements
  pill:  9999,
}

// ─── Shadows ──────────────────────────────────────────────────────────────────
// Ring-based system — depth through halos, not heavy drop shadows.
export const SHADOWS = {
  ringNeutral: '0px 0px 0px 1px #d1cfc5',
  ringBrand:   '0px 0px 0px 1px #0E7C66',   // Pine
  ringDark:    '0px 0px 0px 1px #30302e',

  whisper: 'rgba(0,0,0,0.05) 0px 4px 24px',
  card:    'rgba(0,0,0,0.08) 0px 2px 12px',
  overlay: 'rgba(0,0,0,0.15) 0px 8px 24px',
  dark:    'rgba(0,0,0,0.50) 0px 8px 32px',

  brandGlow: '0 4px 16px rgba(14, 124, 102, 0.40)',  // Pine
}

// ─── Transitions ──────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  fast:   '0.12s ease',
  normal: '0.18s ease',
  slow:   '0.28s cubic-bezier(0.4, 0, 0.2, 1)',
}

// ─── Intent group colors ──────────────────────────────────────────────────────
// Categorical (not status) — frame intent badges and render-mode selectors.
export const INTENT_COLORS = {
  diagram: { bg: '#fce7f3', text: '#be185d', accent: '#fbcfe8' },  // process, architecture, timeline, illustration, svg
  math:    { bg: '#dbeafe', text: '#1d4ed8', accent: '#bfdbfe' },  // math, manim
  concept: { bg: '#fef3c7', text: '#b45309', accent: '#fde68a' },  // concept_analogy, comparison
}
