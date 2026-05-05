// Dark-mode style helpers — return sx-compatible values.
// All are pure functions of isDark so call sites stay readable.

export const cardShadow  = (isDark) =>
  isDark ? '0 2px 12px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)'

export const menuShadow  = (isDark) =>
  isDark
    ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'

export const hoverBg     = (isDark) =>
  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'

export const subtleHoverBg = (isDark) =>
  isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

// Brand-tinted surface: brandTint(isDark, 0.10) → semi-transparent brand overlay
export const brandTint   = (isDark, alpha = 0.10) =>
  isDark ? `rgba(75,114,255,${alpha})` : `rgba(24,71,214,${alpha})`

// Brand-tinted border
export const brandBorder = (isDark, alpha = 0.25) =>
  isDark ? `rgba(75,114,255,${alpha})` : `rgba(24,71,214,${alpha})`
