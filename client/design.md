# Zenith Design System

A production-grade design token system for the Zenith AI-powered visual learning studio. All values live in `src/theme/tokens.js` — change a token there and it propagates everywhere.

---

## Design Philosophy

Zenith is a technical tool that should feel clean, precise, and trustworthy. The aesthetic is modern SaaS — crisp white surfaces, cool slate neutrals, and a vivid blue brand color that signals intelligence and action. The brand color (`#1847D6`) is rich and premium without being hyperlink-cold.

**Principles:**
- Clean white/near-white backgrounds — `#f8fafc` page, `#ffffff` cards
- Rich blue brand — signals intelligence, precision, trust
- Cool slate neutrals for text — the classic, legible SaaS palette
- Typography does the heavy lifting — Inter is optimized for UI reading at all sizes
- No decorative shadows — use ring-based focus feedback, not heavy drop shadows
- Dark mode uses deep neutral black — `#111111` base, cool slate text

---

## Brand Color

| Token | Value | Role |
|---|---|---|
| `BRAND.primary` | `#1847D6` | Zenith Blue — CTAs, active nav, key brand moments |
| `BRAND.accent` | `#4B72FF` | Zenith Blue Light — dark-mode primary, tinted surfaces |
| `BRAND.gradient` | `linear-gradient(135deg, #1847D6 0%, #6B44F8 100%)` | Gradient buttons, logo, hero elements |
| `BRAND.gradientAlt` | `linear-gradient(135deg, #4B72FF 0%, #6B44F8 100%)` | Subtle gradients on dark |
| `BRAND.gradientHover` | `linear-gradient(135deg, #1340C0 0%, #5C38D9 100%)` | Button hover state |

**Why `#1847D6`?** It's vivid and premium — distinct from generic hyperlink blue (`#0000ff`) and cold startup blue (`#0ea5e9`). The slight purple undertone (`→ #6B44F8`) already present in the app's existing gradients makes the primary feel intentional, not random. It passes APCA contrast on both parchment and near-black backgrounds.

---

## Color Palette

### Light Mode

| Token | Value | Role |
|---|---|---|
| `PALETTE.parchment` | `#f8fafc` | Page background |
| `PALETTE.ivory` | `#ffffff` | Card / paper surfaces |
| `PALETTE.warmSand` | `#f1f5f9` | Button bg, interactive surfaces |
| `PALETTE.sidebarLight` | `#f1f5f9` | Sidebar / navigation |
| `PALETTE.nearBlackText` | `#0f172a` | Primary text |
| `PALETTE.oliveGray` | `#64748b` | Secondary text, labels |
| `PALETTE.stoneGray` | `#94a3b8` | Tertiary text, metadata, disabled |
| `PALETTE.charcoalWarm` | `#475569` | Button text on surfaces |
| `PALETTE.borderCream` | `#e2e8f0` | Standard light border |
| `PALETTE.borderWarm` | `#e2e8f0` | Prominent light border |
| `PALETTE.dividerLight` | `#e2e8f0` | Dividers / separators |

### Dark Mode

| Token | Value | Role |
|---|---|---|
| `PALETTE.nearBlack` | `#111111` | Page background |
| `PALETTE.darkSurface` | `#1c1c1c` | Card / paper surfaces |
| `PALETTE.darkSubsurface` | `#262626` | Elevated surfaces, hover states |
| `PALETTE.sidebarDark` | `#0f0f0f` | Sidebar / navigation |
| `PALETTE.warmSilver` | `#f1f5f9` | Primary text |
| `PALETTE.stoneGray` | `#94a3b8` | Secondary text |
| `PALETTE.borderDark` | `#1e293b` | Standard dark border |
| `PALETTE.dividerDark` | `#1e293b` | Dividers / separators |

### Semantic

| Token | Value | Role |
|---|---|---|
| `PALETTE.errorRed` | `#b53333` | Error states — warm, serious |
| `PALETTE.focusBlue` | `#3898ec` | A11y focus rings only — the one cool color |
| `PALETTE.successGreen` | `#22c55e` | Ready / success states |
| `PALETTE.warningOrange` | `#fb923c` | In-progress / warning states |
| `PALETTE.starGold` | `#f59e0b` | Starred / favorited items |
| `PALETTE.loginPanelBg` | `#0d0d1a` | Login left panel (always dark) |

---

## Typography

**Font:** Inter — designed specifically for screen UIs. The industry standard for dense application interfaces (Linear, Vercel, Notion, GitHub). Handles micro (9.6px) through hero (64px) better than display-first fonts like Sora.

**Mono font:** JetBrains Mono — for code, prompts, technical content.

### Size Scale

| Token | px | Role | Weight | Line-height |
|---|---|---|---|---|
| `micro` | 9.6 | Badges, frame numbers, dot labels | 700 | 1.1 |
| `overline` | 10 | Section overlines, ALL CAPS labels | 700 | 1.3 |
| `label` | 12 | Form labels, button text (small), tags | 500–600 | 1.3 |
| `caption` / `bodyXs` | 13 | Helper text, secondary descriptions, metadata | 400 | 1.5 |
| `bodySm` | 14 | Default body text in compact UIs | 400 | 1.6 |
| `body` | 15 | Default body text in spacious UIs | 400 | 1.6 |
| `bodyLg` | 16 | Emphasized body, lead text | 400–500 | 1.6 |
| `subheadSm` | 17 | Card titles, section headers | 600 | 1.4 |
| `subhead` | 20 | Dialog titles, group headers | 600–700 | 1.3 |
| `heading` | 24 | Page titles, modal headers | 700 | 1.2 |
| `headingLg` | 32 | Hero section headings | 700 | 1.1 |
| `display` | 48 | Marketing display text | 700 | 1.05 |
| `hero` | 64 | Full-page hero numbers | 700–800 | 1.0 |

### Weights

| Token | Value | Use |
|---|---|---|
| `light` | 300 | Decorative large text, pull quotes |
| `regular` | 400 | Body text, descriptions |
| `medium` | 500 | Emphasized body, labels |
| `semibold` | 600 | Buttons, headings, nav items, card titles |
| `bold` | 700 | Page headings, hero text, badges |

### Line Heights

| Token | Value | Use |
|---|---|---|
| `tight` | 1.1 | Large display text, hero numbers |
| `snug` | 1.3 | Headings, short labels |
| `normal` | 1.5 | Default body text |
| `relaxed` | 1.6 | Longer descriptions, card copy |
| `loose` | 1.7 | Reading-optimized prose |

### Letter Spacing

| Token | Value | Use |
|---|---|---|
| `tighter` | -0.03em | Large hero headings |
| `tight` | -0.01em | Normal headings |
| `normal` | 0em | Body text |
| `wide` | 0.04em | Small labels, captions |
| `wider` | 0.07em | Overlines |
| `widest` | 0.12em | ALL CAPS labels, tracking text |

---

## Spacing

**Base unit: 8px.** All layout decisions should be multiples of 8 wherever possible. Sub-8px values (`xxs`, `xs`, `sm`) are for micro-spacing within components only — not for layout.

| Token | px | Use |
|---|---|---|
| `xxs` | 3 | Gap between dot indicators, icon padding |
| `xs` | 4 | Tight inline padding, icon-to-text gap |
| `sm` | 6 | Small button padding (vertical), badge padding |
| `md` | 8 | Standard element padding, icon button size |
| `lg` | 12 | Card inner padding (compact), list item gaps |
| `xl` | 16 | Standard inner padding, section gaps |
| `xxl` | 24 | Card padding, dialog padding |
| `xxxl` | 32 | Section spacing, page gutters |
| `huge` | 48 | Large section gaps |
| `max` | 64 | Hero spacing, page-level gaps |

---

## Border Radius

| Token | px | Use |
|---|---|---|
| `none` | 0 | Hard-edged decorative elements |
| `sharp` | 4 | Inline code, compact badges |
| `sm` | 6 | Small secondary buttons, tag pills |
| `md` | 8 | Standard inputs, cards, containers (MUI default) |
| `lg` | 12 | Primary buttons, main content cards, nav items |
| `xl` | 16 | Featured containers, video player wrapper |
| `xxl` | 24 | Large content sections |
| `full` | 32 | Hero containers, feature cards |
| `pill` | 9999 | Status badges, filter chips, fully-rounded buttons |

---

## Shadow System

Ring-based — depth comes from borders and rings, not heavy blur.

| Token | Value | Use |
|---|---|---|
| `ringNeutral` | `0px 0px 0px 1px #e2e8f0` | Default card border ring |
| `ringBrand` | `0px 0px 0px 1px #1847D6` | Active / selected state |
| `ringDark` | `0px 0px 0px 1px #1e293b` | Dark mode card border |
| `whisper` | `rgba(0,0,0,0.05) 0px 4px 24px` | Cards on light background |
| `card` | `rgba(0,0,0,0.08) 0px 2px 12px` | Slightly elevated surfaces |
| `overlay` | `rgba(0,0,0,0.15) 0px 8px 24px` | Modals, dropdowns, popovers |
| `dark` | `rgba(0,0,0,0.50) 0px 8px 32px` | Dark theme overlays |
| `brandGlow` | `0 4px 16px rgba(24,71,214,0.40)` | Primary CTA hover state |

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

- **Contained (primary):** `BRAND.gradient` background, white text, `RADIUS.lg` (12px), no text transform
- **Contained hover:** `BRAND.gradientHover` — slightly darker/deeper
- **Outlined:** `PALETTE.borderWarm` border, mode-appropriate text, `RADIUS.lg`
- **Text/ghost:** transparent, primary color text
- **Size guide:** use `size="small"` for inline actions within cards; default for form submits and primary CTAs

### Cards

- Border: `1.5px solid` — `rgba(255,255,255,0.09)` dark / `#e8ecf2` light
- Background: `PALETTE.darkSurface` dark / `PALETTE.ivory` light
- Border radius: `RADIUS.lg` (12px) for main cards, `RADIUS.md` (8px) for compact cards
- On hover: `border-color → BRAND.primary`, `transform: translateY(-2px)`, `box-shadow → brandGlow`
- No `elevation` — use border + optional whisper shadow instead

### Inputs

- Border: `PALETTE.borderWarm` default, `BRAND.accent + 55` hover, `BRAND.accent + 99` focused
- Background: slightly tinted — `rgba(255,255,255,0.04)` dark / `rgba(0,0,0,0.02)` light
- Focus ring: `PALETTE.focusBlue` (the one cool color, required for a11y)
- Border radius: `RADIUS.md` (8px)

### Sidebar / Navigation

- Background: `PALETTE.sidebarDark` / `PALETTE.sidebarLight`
- Active item: `rgba(75,114,255,0.12)` background, `BRAND.accent` text/icon
- Hover item: `rgba(75,114,255,0.06)` background
- Width: 220px (collapsed: 60px)

### Modals / Dialogs

- Background: `PALETTE.darkSurface` dark / `PALETTE.ivory` light
- Backdrop: `rgba(0,0,0,0.6)` dark / `rgba(0,0,0,0.35)` light
- Border: `1px solid PALETTE.borderDark` dark / `1px solid PALETTE.borderWarm` light
- Max width: 560px standard, 720px wide, 320px compact

### Tooltips

- Background: `PALETTE.darkSurface` dark / `#2a2a2a` light (always dark-ish for contrast)
- Border: `1px solid PALETTE.borderDark`
- Font size: `caption` (13px), `label` weight (500)
- Enter delay: 300–400ms — don't show on quick passes

### Badges / Status Pills

- Border radius: `RADIUS.pill` (9999px) for status, `RADIUS.sharp` (4px) for counts
- Success: `rgba(34,197,94,0.18)` bg, `rgba(34,197,94,0.4)` border, `PALETTE.successGreen` text
- Warning: `rgba(251,146,60,0.18)` bg, `rgba(251,146,60,0.4)` border, `PALETTE.warningOrange` text
- Brand: `rgba(75,114,255,0.18)` bg, `rgba(75,114,255,0.4)` border, `BRAND.accent` text
- Font: `micro` or `overline` (9.6–10px), weight 700

---

## Dark Mode

Dark mode shifts the clean white palette to deep neutral black. The strategy:

1. **Backgrounds shift from `#f8fafc` to `#111111`** — deep neutral black page background
2. **Cards use `#1c1c1c`** — slightly lighter than the page, creating depth without harsh contrast
3. **Text uses `#f1f5f9` (slate-100)** — the same cool slate family, just inverted
4. **Brand color shifts** — primary `#1847D6` → accent `#4B72FF` (lighter for dark backgrounds)
5. **Borders use `#1e293b`** — cool dark slate, consistent with the light-mode slate family

Toggle is handled in `App.jsx`: `document.documentElement.setAttribute('data-theme', mode)` keeps CSS custom properties in sync with MUI's ThemeProvider.

---

## Token System Architecture

```
tokens.js          ← single source of truth (pure JS, zero dependencies)
    ↓
theme/index.js     ← maps tokens to MUI theme slots (only MUI-specific file)
    ↓
ThemeProvider      ← injects into React tree
    ↓
components         ← import tokens directly OR use theme.palette.*

index.css          ← CSS custom properties layer (for non-MUI elements)
    ← also reads tokens via :root / [data-theme="dark"] blocks
```

**If MUI is dropped later:** Delete `theme/index.js` and swap `ThemeProvider`. `tokens.js` and all the CSS custom properties in `index.css` are completely unaffected. Components that import from `tokens.js` directly keep working without any changes.

---

## Do's and Don'ts

### Do
- Import from `tokens.js` for all color, spacing, and radius decisions
- Use `theme.palette.primary.main` for the primary brand color in MUI components — it's already wired to `BRAND.primary` / `BRAND.accent` via `theme/index.js`
- Use `RADIUS.lg` (12px) as your default border radius
- Use slate text tokens — `PALETTE.oliveGray` (`#64748b`), `PALETTE.stoneGray` (`#94a3b8`)
- Use `BRAND.gradient` for gradient buttons; `BRAND.gradientHover` for the hover state
- Test both light and dark modes before shipping any new component

### Don't
- Don't hardcode hex values anywhere except inside `tokens.js`
- Don't use `#001AFF` or `#4F6EFF` — these are the old brand colors; use `BRAND.primary` and `BRAND.accent`
- Don't use heavy drop shadows — use the ring system and `whisper` / `card` shadows
- Don't add `textTransform: 'uppercase'` to buttons — it's handled globally in `theme/index.js`
- Don't use `focusBlue` (`#3898ec`) for anything other than a11y focus rings
