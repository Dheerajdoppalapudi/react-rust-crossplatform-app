import { createContext, useContext, createElement } from 'react'

const SHARED = {
  fontDisplay: '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
  fontBody:    '"Hanken Grotesk", system-ui, sans-serif',
  fontMono:    '"JetBrains Mono", ui-monospace, monospace',
  easeOut:  'cubic-bezier(0.16, 1, 0.3, 1)',
  easeSoft: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
}

export const DARK = {
  ...SHARED,
  bg0: '#04080a', bg1: '#070e11', bg2: '#0a141a',
  surface: '#0c1820', surface2: '#102530',
  line: 'rgba(150, 210, 190, 0.10)', lineStrong: 'rgba(150, 210, 190, 0.20)',
  text0: '#ecf4f0', text1: '#9bb3ab', text2: '#5e746d',
  green: '#26e0a8', greenRgb: '38, 224, 168',
  cyan: '#29e6e0', cyanRgb: '41, 230, 224',
  violet: '#9a7bff', violetRgb: '154, 123, 255',
  pine: '#0e7c66', pineHover: '#0a6353',
  isDark: true,
}

export const LIGHT = {
  ...SHARED,
  bg0: '#f7faf8', bg1: '#eff6f2', bg2: '#e6f1ec',
  surface: '#ddeae3', surface2: '#d2e3da',
  line: 'rgba(10, 60, 38, 0.10)', lineStrong: 'rgba(10, 60, 38, 0.20)',
  text0: '#071510', text1: '#2c4d3a', text2: '#5a7d68',
  green: '#0b8c62', greenRgb: '11, 140, 98',
  cyan: '#0b8c8a', cyanRgb: '11, 140, 138',
  violet: '#6b4fcc', violetRgb: '107, 79, 204',
  pine: '#0b6b55', pineHover: '#085c49',
  isDark: false,
}

// backward-compat default
export const P = DARK

// ─── Theme context (avoids a separate file) ───────────────────────────────────
const ThemeCtx = createContext(DARK)

export function LandingThemeProvider({ tokens, children }) {
  return createElement(ThemeCtx.Provider, { value: tokens }, children)
}

export const useLandingTheme = () => useContext(ThemeCtx)
