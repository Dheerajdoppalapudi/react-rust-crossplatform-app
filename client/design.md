# Paralyte Design System

A production-grade design token system for the Paralyte AI-powered visual learning studio. All values live in `src/theme/tokens.js` — change a token there and it propagates everywhere.

---

## Design Philosophy

Paralyte is a technical tool that should feel clean, precise, and trustworthy. The aesthetic is modern neutral SaaS — crisp white/black surfaces, warm neutral text, and a Pine-green brand color used sparingly. Inspired by Perplexity and Linear.

**Principles:**
- **Neutral-first** — buttons, active states, and interactive fills use opacity-based white/black. Nothing feels "colored" unless it's intentional.
- **Brand is a punctuation mark** — Pine (`#0E7C66`) appears in exactly two places: the send button and the prompt bar's focus border. Everywhere else is neutral.
- **No gradients** — solid backgrounds only. Gradients were removed to reduce visual noise.
- **No heavy drop shadows** — depth comes from subtle borders and ring-based feedback.
- **Typography does the heavy lifting** — Inter handles all hierarchy; color is not a primary hierarchy tool.
- **Dark mode** — deep neutral black (`#111111` base), no blue undertone in borders.

---

## Brand Color

| Token | Value | Role |
|---|---|---|
| `BRAND.primary` | `#0E7C66` | Pine — send button (light mode), focus border (light mode) |
| `BRAND.hover` | `#0A6353` | Pine hover — send button hover state |
| `BRAND.press` | `#084C40` | Pine pressed — send button :active |
| `BRAND.soft` | `#DCEDE8` | Tinted surface fill (selection highlights) on light |
| `BRAND.glow` | `#2FD4B5` | Bright teal — dark-mode send button + focus border |
| `BRAND.accent` | `#2FD4B5` | Alias for `glow` — dark-mode brand moments |

**Brand usage rule:** Brand color appears **only** on:
1. The send button (`backgroundColor: brandColor(isDark)` from `styleUtils.js`)
2. The prompt bar `focus-within` border (`borderColor: brandColor(isDark)`)

Do NOT use `theme.palette.primary.main` for brand — it is wired to neutral.

**Helper:** `brandColor(isDark)` from `src/theme/styleUtils.js` returns `BRAND.accent` (dark) or `BRAND.primary` (light).

---

## MUI Primary Color

`theme.palette.primary.main` is **neutral**, not brand:
- Dark mode: `PALETTE.warmSilver` (`#f1f5f9`)
- Light mode: `PALETTE.nearBlackText` (`#0f172a`)

This prevents MUI's internal components (spinners, checkboxes, switches, etc.) from bleeding the brand color. Any component that needs brand color must reference `BRAND.primary` / `brandColor(isDark)` explicitly.

---

## Color Palette

### Light Mode

| Token | Value | Role |
|---|---|---|
| `PALETTE.parchment` | `#f8fafc` | Page background |
| `PALETTE.ivory` | `#ffffff` | Card / paper surfaces |
| `PALETTE.warmSand` | `#f1f5f9` | Button backgrounds, interactive surfaces, sidebar |
| `PALETTE.sidebarLight` | `#f1f5f9` | Sidebar / navigation |
| `PALETTE.nearBlackText` | `#0f172a` | Primary text |
| `PALETTE.oliveGray` | `#64748b` | Secondary text, labels |
| `PALETTE.stoneGray` | `#94a3b8` | Tertiary text, metadata, disabled |
| `PALETTE.charcoalWarm` | `#475569` | Neutral button text |
| `PALETTE.border` | `#e2e8f0` | Standard light border + divider |

### Dark Mode

| Token | Value | Role |
|---|---|---|
| `PALETTE.nearBlack` | `#111111` | Page background |
| `PALETTE.darkSurface` | `#1c1c1c` | Card / paper surfaces |
| `PALETTE.darkSubsurface` | `#262626` | Elevated surfaces, hover states |
| `PALETTE.sidebarDark` | `#0f0f0f` | Sidebar / navigation |
| `PALETTE.warmSilver` | `#f1f5f9` | Primary text |
| `PALETTE.stoneGray` | `#94a3b8` | Secondary text |
| `PALETTE.borderDark` | `#2a2a2a` | Standard dark border — **neutral gray, no blue tint** |

### Deprecated Aliases (kept for backwards compat, do not use in new code)

| Alias | Maps to |
|---|---|
| `PALETTE.borderCream` | `PALETTE.border` |
| `PALETTE.borderWarm` | `PALETTE.border` |
| `PALETTE.dividerLight` | `PALETTE.border` |
| `PALETTE.dividerDark` | `PALETTE.borderDark` |

### Semantic (status-only, not brand)

| Token | Value | Role |
|---|---|---|
| `SEMANTIC.success` | `#4F8A5B` | Muted sage-green — success badges/icons |
| `SEMANTIC.successText` | `#3B6B45` | Darker, for text on light backgrounds |
| `SEMANTIC.danger` | `#C0473B` | Warm brick red — errors |
| `SEMANTIC.dangerText` | `#9A372D` | Darker, for text |
| `SEMANTIC.warning` | `#C0883E` | Muted ochre |
| `SEMANTIC.warningText` | `#956726` | Darker, for text |
| `SEMANTIC.info` | `#3E6B8A` | Muted steel-blue |
| `SEMANTIC.infoText` | `#2F526B` | Darker, for text |
| `PALETTE.focusBlue` | `#3898ec` | A11y focus rings ONLY — never for brand |
| `PALETTE.starGold` | `#f59e0b` | Starred / favorited items |
| `PALETTE.errorRed` | same as `SEMANTIC.danger` | MUI `error.main` |

---

## Neutral Style Helpers (`src/theme/styleUtils.js`)

All opacity-based fills and border strokes should use these helpers — never write inline `rgba(255,255,255,x)` directly in sx props.

```js
import { neutralSurface, neutralBorder, brandColor, ... } from '../../theme/styleUtils.js'
```

### Background fills (pass `isDark = theme.palette.mode === 'dark'`)

| Helper | Dark | Light | Use |
|---|---|---|---|
| `neutralGhost(d)` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.02)` | Very subtle bg, Pill inactive |
| `neutralSubtle(d)` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` | Menu hover, code inline bg |
| `neutralSurface(d)` | `rgba(255,255,255,0.09)` | `rgba(0,0,0,0.06)` | Button default, stop button |
| `neutralHover(d)` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.08)` | Hover fill |
| `neutralActive(d)` | `rgba(255,255,255,0.14)` | `rgba(0,0,0,0.10)` | Strong hover / pressed |
| `neutralToggle(d)` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.07)` | Active toggle background |

### Border strokes

| Helper | Dark | Light | Use |
|---|---|---|---|
| `neutralBorderFaint(d)` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.08)` | Chip borders, very subtle |
| `neutralBorderDefault(d)` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.10)` | Inactive button border |
| `neutralBorder(d)` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.14)` | Pill outline, normal border |
| `neutralBorderStrong(d)` | `rgba(255,255,255,0.22)` | `rgba(0,0,0,0.18)` | Active / selected border |
| `neutralBorderHover(d)` | `rgba(255,255,255,0.30)` | `rgba(0,0,0,0.22)` | Hover border |

### Brand helpers

| Helper | Returns | Use |
|---|---|---|
| `brandColor(d)` | `BRAND.accent` (dark) / `BRAND.primary` (light) | Send button, focus border |
| `brandHover()` | `BRAND.hover` | Send button hover |

### Shadow helpers

| Helper | Dark | Light |
|---|---|---|
| `cardShadow(d)` | `0 2px 12px rgba(0,0,0,0.35)` | `0 2px 12px rgba(0,0,0,0.06)` |
| `menuShadow(d)` | `0 8px 32px rgba(0,0,0,0.6)` | `0 8px 32px rgba(0,0,0,0.12)` |

---

## Typography

**Font:** Inter — designed specifically for screen UIs. Handles micro (9.6px) through hero (64px).

**Mono font:** JetBrains Mono — code, terminals, technical content.

### Size Scale

| Token | px | Role | Weight | Line-height |
|---|---|---|---|---|
| `micro` | 9.6 | Badges, frame numbers, dot labels | 700 | 1.1 |
| `overline` | 10 | Section overlines, ALL CAPS labels | 700 | 1.3 |
| `label` | 12 | Form labels, button text (small), tags | 500–600 | 1.3 |
| `caption` / `bodyXs` | 13 | Helper text, secondary descriptions | 400 | 1.5 |
| `bodySm` | 14 | Default body text (compact UIs) | 400 | 1.6 |
| `body` | 15 | Default body text (spacious UIs) | 400 | 1.6 |
| `bodyLg` | 16 | Emphasized body, lead text | 400–500 | 1.6 |
| `subheadSm` | 17 | Card titles, section headers | 600 | 1.4 |
| `subhead` | 20 | Dialog titles, group headers | 600–700 | 1.3 |
| `heading` | 24 | Page titles, modal headers | 700 | 1.2 |
| `headingLg` | 32 | Hero section headings | 700 | 1.1 |
| `display` | 48 | Marketing display text | 700 | 1.05 |
| `hero` | 64 | Full-page hero numbers | 700–800 | 1.0 |

---

## Spacing

**Base unit: 8px.** All layout decisions should be multiples of 8 wherever possible.

| Token | px | Use |
|---|---|---|
| `xxs` | 3 | Gap between dot indicators, icon padding |
| `xs` | 4 | Tight inline padding, icon-to-text gap |
| `sm` | 6 | Small button padding (vertical), badge padding |
| `md` | 8 | Standard element padding |
| `lg` | 12 | Compact card inner padding, list item gaps |
| `xl` | 16 | Standard inner padding, section gaps |
| `xxl` | 24 | Card padding, dialog padding |
| `xxxl` | 32 | Section spacing, page gutters |
| `huge` | 48 | Large section gaps |
| `max` | 64 | Hero spacing |

---

## Border Radius

| Token | px | Use |
|---|---|---|
| `none` | 0 | Hard-edged decorative elements |
| `sharp` | 3 | Inline code, compact badges |
| `sm` | 4 | Very small secondary elements |
| `md` | 6 | Standard inputs, compact cards (MUI default) |
| `lg` | 8 | Primary buttons, main content cards |
| `xl` | 12 | Featured containers |
| `xxl` | 16 | Large content sections |
| `full` | 24 | Hero containers |
| `pill` | 9999 | Status badges, filter chips, fully-rounded buttons |

---

## Shadow System

Ring-based — depth through borders, not heavy blur.

| Token | Value | Use |
|---|---|---|
| `ringNeutral` | `0px 0px 0px 1px #d1cfc5` | Default card border ring |
| `ringBrand` | `0px 0px 0px 1px #0E7C66` | Active / focused state (Pine) |
| `ringDark` | `0px 0px 0px 1px #30302e` | Dark mode card border |
| `whisper` | `rgba(0,0,0,0.05) 0px 4px 24px` | Cards on light background |
| `card` | `rgba(0,0,0,0.08) 0px 2px 12px` | Slightly elevated surfaces |
| `overlay` | `rgba(0,0,0,0.15) 0px 8px 24px` | Modals, dropdowns |
| `dark` | `rgba(0,0,0,0.50) 0px 8px 32px` | Dark theme overlays |
| `brandGlow` | `0 4px 16px rgba(14, 124, 102, 0.40)` | Pine glow for brand CTAs |

---

## Transitions

| Token | Value | Use |
|---|---|---|
| `fast` | `0.12s ease` | Hover states, color changes |
| `normal` | `0.18s ease` | Layout shifts, opacity changes |
| `slow` | `0.28s cubic-bezier(0.4, 0, 0.2, 1)` | Panel open/close, modals |

---

## Component Conventions

### Buttons

Buttons are **neutral by default** — Perplexity/Linear style:

- **Contained (default):** `neutralSurface(isDark)` background, `text.primary` color, `neutralBorderFaint(isDark)` border
- **Contained hover:** `neutralActive(isDark)` background
- **Outlined:** `PALETTE.border` / `PALETTE.borderDark` border
- **Send button (only brand button):** `brandColor(isDark)` background, white text, `brandHover()` on hover
- **No gradients anywhere**

### Cards (SessionNode, content cards)

- Border: `1.5px solid` — `rgba(255,255,255,0.09)` dark / `#e8ecf2` light
- Background: `PALETTE.darkSurface` dark / `PALETTE.ivory` light
- Border radius: `RADIUS.lg` (8px) for main cards
- Hover: `neutralBorderHover(isDark)` border, `translateY(-2px)` — **no brand color on hover**

### Frame Thumbnails

- Default border: `neutralBorderDefault(isDark)` (2px)
- Active border: `neutralBorderStrong(isDark)` (2px) — **no Pine teal**
- Hover border: `neutralBorderHover(isDark)`
- No box-shadow glow on active

### Prompt Bar

- Default border: `PALETTE.dividerDark` / `PALETTE.borderCream`
- **Focus-within border: `brandColor(isDark)`** ← one of two brand moments
- Focus shadow: `rgba(14,124,102,0.18)` dark / `rgba(14,124,102,0.10)` light

### Inputs (non-prompt)

- Border: `PALETTE.border` / `PALETTE.borderDark`
- Focus: `PALETTE.focusBlue` ring (a11y)

### Sidebar / Navigation

- Background: `PALETTE.sidebarDark` / `PALETTE.sidebarLight`
- Active item background: `neutralSurface(isDark)` — **not brand color**
- Active item text/icon: `text.primary` — **not brand color**
- Hover: `neutralSubtle(isDark)`

### Modals / Dialogs

- Background: `PALETTE.darkSurface` dark / `PALETTE.ivory` light
- Backdrop: `rgba(0,0,0,0.75)` with `backdropFilter: blur(6px)`
- Border: `1px solid PALETTE.borderDark` dark / `1px solid PALETTE.border` light

### Tooltips

- Background: `PALETTE.darkSubsurface` dark / `PALETTE.nearBlack` light (always dark-ish)
- Text: `PALETTE.warmSilver`
- Font size: `label` (12px), weight 500
- Enter delay: 400ms

### Badges / Status Pills

- Border radius: `RADIUS.pill` for status, `RADIUS.sharp` for counts
- Success: `rgba(46,160,67,0.12)` bg, `SEMANTIC.success` text
- Warning: `rgba(240,136,62,0.12)` bg, `SEMANTIC.warning` text
- Error: `rgba(248,81,73,0.12)` bg, `SEMANTIC.danger` text
- **No brand-colored badges** — use semantic colors only
- Font: `micro` or `overline` (9.6–10px), weight 700

### Loading / Spinners

- The Paralyte logo spinner: `color: 'text.secondary'` — **not brand color**
- `CircularProgress`: defaults to `primary` (now neutral) — fine as is
- Stage dots / progress bars: neutral fills

---

## Dark Mode

1. **Page:** `#f8fafc` → `#111111` (pure neutral black, no blue tint)
2. **Cards:** `#ffffff` → `#1c1c1c`
3. **Text:** `#0f172a` → `#f1f5f9`
4. **Brand shift:** `BRAND.primary` (#0E7C66) → `BRAND.accent` (#2FD4B5) — brighter for dark bg
5. **Borders:** `#e2e8f0` → `#2a2a2a` — **pure neutral gray, no blue undertone**
6. **Interactive fills:** opacity-based rgba over transparent (see styleUtils.js helpers)

Toggle: `App.jsx` writes `document.documentElement.dataset.theme` to keep CSS vars in sync with MUI.

---

## Token System Architecture

```
tokens.js          ← single source of truth (pure JS, zero dependencies)
    ↓
styleUtils.js      ← theme-aware helper functions (isDark → rgba strings)
    ↓
theme/index.js     ← maps tokens to MUI theme slots (primary = neutral)
    ↓
ThemeProvider      ← injects into React tree
    ↓
components         ← import tokens/styleUtils directly OR use theme.palette.*

index.css          ← CSS custom properties for non-MUI elements
```

**Key rule:** `theme.palette.primary.main` is **neutral**. Use `brandColor(isDark)` from `styleUtils.js` for the two intentional brand moments only.

---

## Do's and Don'ts

### Do
- Import from `tokens.js` for colors, spacing, radius
- Import helpers from `styleUtils.js` for all opacity-based fills and borders
- Use `brandColor(isDark)` only on the send button and prompt bar focus border
- Use semantic tokens (`SEMANTIC.*`) for status/feedback states
- Use `PALETTE.focusBlue` for a11y focus rings only
- Test both light and dark modes before shipping

### Don't
- Don't write `rgba(255,255,255,x)` or `rgba(0,0,0,x)` inline — use styleUtils helpers
- Don't hardcode hex values outside `tokens.js`
- Don't use `theme.palette.primary.main` expecting it to be Pine — it's neutral
- Don't use brand color on hover states, active nav, or interactive highlights
- Don't use `BRAND.gradient`, `BRAND.gradientAlt`, `BRAND.gradientHover` — they're removed
- Don't add gradient backgrounds to any component
- Don't use `focusBlue` for anything other than a11y focus rings
- Don't use heavy drop shadows — use the ring system and `whisper`/`card` shadows
