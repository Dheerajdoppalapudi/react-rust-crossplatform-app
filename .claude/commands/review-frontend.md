# review-frontend

You are reviewing a frontend code change against Zenith's established patterns. For each item, report **PASS**, **FAIL**, or **N/A**. Any FAIL must be fixed before the change is merged.

Run this review on every file touched by the change.

---

## 1. API calls

| # | Check | Status |
|---|---|---|
| 1.1 | No `fetch()` calls in components — all HTTP calls go through `api.js` | |
| 1.2 | New `api.js` methods default to throwing on error (not returning null) unless documented otherwise | |
| 1.3 | Null-returning api.js methods have a JSDoc comment explaining why null is the right sentinel | |
| 1.4 | User-initiated action failures (`generate`, `rename`, `merge`, `delete`) caught and surfaced via `toast.error()` | |
| 1.5 | Background/optional data failures (frames meta, conversation tree) caught silently with a console warning | |

---

## 2. Theming

| # | Check | Status |
|---|---|---|
| 2.1 | All colors use `theme.palette.*` tokens — no hardcoded hex/rgba in new code | |
| 2.2 | `useTheme()` imported and called where theme tokens are used | |
| 2.3 | Styles use MUI `sx` prop — no `style={{color:'...'}}` for theme-dependent values | |
| 2.4 | Documented exceptions left unchanged: video overlay `rgba(0,0,0,0.55)`, AppFallback dark colors | |
| 2.5 | Dark mode and light mode both look correct (check by toggling the sidebar theme button) | |

---

## 3. State ownership

| # | Check | Status |
|---|---|---|
| 3.1 | `conversations[]` and `activeConvId` only mutated via callbacks from `App.jsx` | |
| 3.2 | `turns[]`, `prompt`, `pauseContext`, `selectedModel` only mutated via callbacks from `Studio.jsx` | |
| 3.3 | New state added to the correct owner — not pushed down into a child that doesn't need to own it | |
| 3.4 | Pure controlled components have no internal state except UI-only concerns (open/closed, hover, anchor) | |
| 3.5 | Context used only for cross-cutting concerns (`useAuth`, `useToast`) — not as a shortcut to avoid prop drilling for domain data | |

---

## 4. Error boundaries

| # | Check | Status |
|---|---|---|
| 4.1 | Any subtree that renders API data is wrapped in `<ErrorBoundary>` | |
| 4.2 | Level chosen correctly: `"component"` for per-item, `"page"` for content area, `"app"` only in `main.jsx` | |
| 4.3 | `<ErrorBoundary>` not added where already present in a parent (avoid duplicate boundaries on the same subtree) | |

---

## 5. Component placement

| # | Check | Status |
|---|---|---|
| 5.1 | New components placed in `Studio/` (session UI) or `common/` (app shell) — never in `product/` | |
| 5.2 | If `product/` components were touched: confirmed they are still actively imported before editing | |
| 5.3 | File name is PascalCase and ends in `.jsx` | |

---

## 6. Authentication

| # | Check | Status |
|---|---|---|
| 6.1 | New page routes that require login are wrapped in `<ProtectedRoute>` in `App.jsx` | |
| 6.2 | No token handling, localStorage token reads, or manual auth header construction outside `AuthContext.jsx` and `api.js` | |

---

## 7. Accessibility

| # | Check | Status |
|---|---|---|
| 7.1 | Icon-only interactive elements have `aria-label` | |
| 7.2 | New interactive lists have `role="listbox"` (or appropriate role), `tabIndex={0}`, and keyboard navigation | |
| 7.3 | No new `aria-live` regions created — use the existing toast system (`useToast`) for announcements | |

---

## 8. Code quality

| # | Check | Status |
|---|---|---|
| 8.1 | No `console.log()` left in committed code (console.warn/error for handled failures is acceptable) | |
| 8.2 | `useEffect` dependency arrays are complete — no stale closures | |
| 8.3 | Event handlers are stable references where needed (`useCallback`) to avoid unnecessary child re-renders | |
| 8.4 | No inline function definitions passed as `sx` values (creates new objects on every render) | |

---

## 9. Linting

```bash
cd client && npm run lint
```

Zero new ESLint errors or warnings. Any lint failure is a FAIL.

---

## Summary

After reviewing all items, list:

**FAILs** (must fix):
- ...

**Recommendations** (should fix, not blocking):
- ...

**Notes**:
- ...
