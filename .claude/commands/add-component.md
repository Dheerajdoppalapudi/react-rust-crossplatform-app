# add-component

You are adding a new React component to the Zenith frontend. Follow every step in order. Self-verify each checkbox before moving on.

---

## Step 0 — Gather requirements

If any of these are not clear from the request, ask before writing code:

- Where in the component tree does it live? (session UI, app shell, error boundary)
- Does it fetch data from the API?
- Does it need to show toast notifications?
- Is it a pure presentational component, or does it own state?

---

## Step 1 — File placement

| Situation | Directory |
|---|---|
| Studio session UI (frames, video, prompts) | `client/src/components/Studio/` |
| App-wide shell (sidebar, navbar, layout) | `client/src/components/common/` |
| Error fallback UI | `client/src/components/error/` |
| Route-level page | `client/src/pages/` |

**Never** add new components to `client/src/components/product/` — that folder is legacy and may be removed. Check whether any product/ file you touch is actually imported before editing it.

File naming: `PascalCase.jsx`. Co-locate tightly coupled sub-components in the same file if they are small and only used by the parent.

---

## Step 2 — Theming (mandatory for every component)

```jsx
import { useTheme } from '@mui/material/styles'

function MyComponent() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.background.paper,
        borderColor: isDark ? '#2e2e2e' : '#e2e8f0',
      }}
    />
  )
}
```

**Rules:**
- All colors via `theme.palette.*` tokens — never hardcoded hex or rgba except documented exceptions
- Styles via MUI `sx` prop — never `style={{color: '#hex'}}` for theme-dependent values
- Spacing via MUI scale (1 = 8px): `sx={{ p: 2, gap: 1.5 }}`

**Documented hardcoded exceptions — do not change these:**
- Video player overlay: `rgba(0,0,0,0.55)` — intentional
- `AppFallback` in ErrorBoundary: `bgcolor:'#111'`, `color:'#f1f5f9'` — pending theme migration, acceptable for now

---

## Step 3 — Error surfaces

```jsx
import { useToast } from '../../contexts/ToastContext'

const toast = useToast()

// User-initiated action failure — always show toast
try {
  await api.doSomething()
} catch (err) {
  toast.error('Could not complete action. Please try again.')
}

// Background / optional data failure — catch silently, log to console
try {
  const meta = await api.getFramesMeta(sessionId)
} catch (err) {
  console.warn('frames meta unavailable', err)
  // component handles null gracefully
}
```

**Rule:** user-initiated failures always surface via `toast.error()`. Background/optional data failures are caught silently (with a console.warn) when absence is non-fatal.

Wrap any subtree that consumes API data in an `ErrorBoundary`:

```jsx
import ErrorBoundary from '../error/ErrorBoundary'

<ErrorBoundary level="component">
  <MyDataConsumingComponent />
</ErrorBoundary>
```

Levels: `"app"` (full screen), `"page"` (content area, sidebar stays), `"component"` (inline error card).

---

## Step 4 — API calls

```jsx
import { api } from '../../services/api'

// Inside component or hook
const data = await api.someMethod(args)
```

**Rules:**
- Never call `fetch()` directly in a component — always use `api.js` methods
- If you need a new API call, add it to `client/src/services/api.js` as a named method on the `api` object
- New api.js methods **default to throwing on error** (not returning null) unless the caller specifically needs null-on-failure — document with a JSDoc comment if using the null pattern

---

## Step 5 — State ownership

Before adding `useState`, ask where this state belongs:

| State | Owner |
|---|---|
| `conversations[]`, `activeConvId` | `App.jsx` — pass callbacks via props |
| `turns[]`, `prompt`, `pauseContext`, `selectedModel` | `Studio.jsx` — pass down as props or callbacks |
| UI-only state (dropdown open, hover, active tab) | Local `useState` in the component |

**Pure controlled components** (like `PromptBar`) have no internal state except UI-only concerns. All data flows in via props, all mutations flow out via callbacks.

Do not reach into Context for data that should come from props. Only use Context for cross-cutting concerns: auth (`useAuth()`), toasts (`useToast()`).

---

## Step 6 — Authentication gates

If the component is a new page route that requires login:

```jsx
// In App.jsx routing
<Route path="/my-page" element={
  <ProtectedRoute>
    <MyPage />
  </ProtectedRoute>
} />
```

Never access or store auth tokens anywhere other than `AuthContext` and `api.js`. Never read `localStorage` for tokens.

---

## Step 7 — Accessibility

```jsx
// Icon-only buttons must have aria-label
<IconButton aria-label="Delete conversation">
  <DeleteIcon />
</IconButton>

// Interactive lists
<Box role="listbox" tabIndex={0} onKeyDown={handleKeyDown}>
  {items.map(item => (
    <Box key={item.id} role="option" aria-selected={item.id === selected}>
      {item.label}
    </Box>
  ))}
</Box>
```

Requirements:
- Icon-only interactive elements: `aria-label`
- List/grid keyboard navigation: `role`, `tabIndex`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` handlers
- Toast system already has `aria-live="polite"` — use it, don't create parallel notification mechanisms

---

## Step 8 — Self-verification checklist

- [ ] File placed in correct directory (never `components/product/`)
- [ ] `useTheme()` used for all colors — no raw hex/rgba except documented exceptions
- [ ] Styles via `sx` prop — no `style={{}}` for theme-dependent values
- [ ] User-initiated errors surfaced via `toast.error()`
- [ ] API calls via `api.js` — no `fetch()` in component
- [ ] State in the correct owner (App/Studio/local)
- [ ] New page routes wrapped in `<ProtectedRoute>` if auth required
- [ ] Icon-only buttons have `aria-label`
- [ ] Linting passes: `cd client && npm run lint`
- [ ] Checked in both dark and light mode (toggle with the theme button in sidebar)
