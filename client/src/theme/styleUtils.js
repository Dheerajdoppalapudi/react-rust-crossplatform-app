import { BRAND } from './tokens.js'
import { textShimmer } from './animations.js'

// ─── Neutral background fills ──────────────────────────────────────────────────
// Pure functions of isDark (theme.palette.mode === 'dark').
// Use these instead of inline rgba strings in sx props.
export const neutralGhost   = (d) => d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
export const neutralSubtle  = (d) => d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
export const neutralSurface = (d) => d ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'
export const neutralHover   = (d) => d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
export const neutralActive  = (d) => d ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'
export const neutralToggle  = (d) => d ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'

// ─── Neutral border strokes ────────────────────────────────────────────────────
export const neutralBorderFaint   = (d) => d ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
export const neutralBorderDefault = (d) => d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
export const neutralBorder        = (d) => d ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'
export const neutralBorderStrong = (d) => d ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
export const neutralBorderHover  = (d) => d ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.22)'

// ─── Shadow helpers ────────────────────────────────────────────────────────────
export const cardShadow = (d) =>
  d ? '0 2px 12px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)'

export const menuShadow = (d) =>
  d ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)'

// ─── Brand color (Pine) ────────────────────────────────────────────────────────
// Use ONLY on: (1) send button background, (2) prompt bar focus-within border.
export const brandColor = (d) => d ? BRAND.accent  : BRAND.primary
export const brandHover = ()  => BRAND.hover

// ─── Glass panel background (toolbar pills, floating controls) ─────────────────
// High-opacity surface with backdrop blur — distinct from solid card backgrounds.
export const glassPanelBg     = (d) => d ? 'rgba(20,20,20,0.94)' : 'rgba(255,255,255,0.94)'
export const glassPanelShadow = (d) => d ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.10)'

// ─── Meta text ─────────────────────────────────────────────────────────────────
// For timestamps, domains, counts, and other tertiary metadata.
// Meets WCAG AA 3:1 minimum for non-body text at these opacities.
export const metaText = (d) => d ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)'

// ─── Thin custom scrollbar ─────────────────────────────────────────────────────
// Spread into an sx prop on any scroll container: { ...scrollbarSx(theme) }
export const scrollbarSx = (theme, width = 4) => ({
  '&::-webkit-scrollbar':       { width },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
})

// ─── Text shimmer (active stage / beat animation) ─────────────────────────────
// Apply as spread in sx: { ...shimmerTextSx(isDark) }
export const shimmerTextSx = (d) => ({
  backgroundImage: `linear-gradient(90deg,
    ${d ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'} 35%,
    ${d ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.76)'} 50%,
    ${d ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'} 65%)`,
  backgroundSize:       '300% 100%',
  backgroundClip:       'text',
  WebkitBackgroundClip: 'text',
  color:                'transparent',
  animation:            `${textShimmer} 1.6s linear infinite`,
  transition:           'none',
})
