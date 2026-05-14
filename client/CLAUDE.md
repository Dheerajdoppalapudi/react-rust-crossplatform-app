# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server on port 5173
npm run build        # Production build
npm run preview      # Preview production build on port 4173
npm run lint         # ESLint check
npm run test         # Run Vitest once
npm run test:watch   # Vitest in watch mode
npm run test:cov     # Coverage report (70% line threshold enforced)
```

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID   # Required — app fails fast on missing value
VITE_API_URL            # Optional — defaults to http://localhost:8000
```

## Architecture Overview

**Zenith** is a React 19 / Vite 7 desktop app (Tauri) for AI-powered visual lessons. The backend speaks a standard `{ status, data }` / `{ status, error }` envelope over REST + SSE.

### Routing & App Shell

`main.jsx` → `GoogleOAuthProvider → ErrorBoundary → BrowserRouter → App`

All pages are lazy-loaded. Route params are the source of truth for active state — `activeConvId` is derived from `:convId` in the URL, not held in a separate state variable, to prevent URL/state desync.

```
/            AboutUs (public)
/login       Login
/register    Register
/studio      Studio (protected)
/studio/:convId  Studio with active conversation (protected)
/settings    Settings (protected)
```

### Auth Architecture (`src/contexts/AuthContext.jsx` + `src/services/authBridge.js`)

Dual-token design:
- **Access token** — held in memory only (never localStorage; XSS-safe). `getAccessToken()` in `authBridge.js`.
- **Refresh token** — HTTP-only cookie, sent automatically via `credentials: 'include'`.

On mount, `AuthContext` silently calls `POST /auth/refresh` to restore a session from the cookie. On any 401, `api.js` calls the refresh callback via `authBridge`, retries the original request once, then logs the user out on second failure.

`authBridge.js` exists specifically so `api.js` can trigger token refresh/logout without importing React hooks (avoids circular dependencies).

React 18 Strict Mode double-effect is handled via a module-level promise deduplication in `AuthContext`.

### SSE Streaming (`src/services/api.js` → `_readSSEStream`)

All generation (text, deep research, video) flows through `POST /api/generate` as a server-sent event stream. The private `_readSSEStream()` helper handles:
- Partial chunk buffering (incomplete SSE lines across network packets)
- Detecting stream closure without a `done` event (synthetic error injection)
- Abort signal forwarding

Event sequence on a generation: `stage` → `stage_done` → `source` → `token` → `synthesis_done` → `meta` → `block`* → `frame`* → `done`. An `error` event can appear at any point.

**First-turn bootstrap pattern:** On a brand-new conversation (no `activeConvId`), the `turns` array starts empty — there is no turn row to update. `useGeneration` maintains a `firstTurnStagingRef` that accumulates `stages`/`sources`/`synthesisText` from SSE events until the `meta` event arrives and creates the real turn, at which point the staged data is carried forward.

### Generation Hook (`src/hooks/useGeneration.js`)

Three entry points — `handleGenerate` (new prompt), `handleLearnGenerate` (learn-mode follow-up), `handleRetryGeneration` (retry a failed turn) — all share a `createFollowUpSSEHandler(id, opts)` factory for the common six event types (`stage`, `stage_done`, `meta`, `block`, `done`, `error`). `handleGenerate` owns its own switch because it also handles `init`, `source`, `token`, `synthesis_done`, `frame` and the first-turn bootstrap logic.

Each handler creates a `generationIdRef`-based `isStale()` guard and an `AbortController`, both stored in `generationAbortRef` so navigation can cancel in-flight streams.

### Theme System

```
src/theme/tokens.js     Design tokens (BRAND, PALETTE, TYPOGRAPHY, RADIUS)
src/theme/index.js      buildTheme(mode) → MUI ThemeProvider config
src/theme/animations.js Keyframe exports: pulse, fadeIn, shimmer, blink
src/theme/styleUtils.js Helper fns for theme-aware sx values
```

Light/dark preference is persisted in `localStorage` under key `zenith-theme`. `ColorModeContext` (created in `App.jsx`) exposes `{ mode, toggle }`. The current mode is also written to `document.documentElement.dataset.theme` for CSS variable targeting.

Always use tokens from `tokens.js` for colors — never hardcode hex values in component `sx` props.

### Toast Notifications (`src/contexts/ToastContext.jsx`)

`useToast()` returns `{ success, error, info, warning, dismiss }`. Max 3 toasts visible simultaneously; older ones are dropped. This context is available everywhere inside `<ToastProvider>` — components should not manage their own snackbar state.

### API Service Layer (`src/services/api.js`)

All calls go through `_request(path, options)` which:
1. Attaches the Bearer token from `authBridge`
2. Merges a 30-second timeout AbortSignal with any caller-provided signal
3. Unwraps `{ status: "success", data }` → returns `data`
4. On 401, triggers silent refresh then retries once

`src/services/schemas.js` defines Zod schemas (`TurnSchema`, `ConversationSchema`, `ConversationSummarySchema`) with a `safeParse()` helper that logs validation failures and reports to Sentry in production without crashing.

### Component Organization

```
src/components/
  Studio/          Workspace UI (PromptBar, LoadingView, SessionView, StudioToolbar, …)
  Interactive/     Block renderers — BlockRenderer routes by type to entity components
                   (MarkdownText, SandboxedFrame, MermaidViewer, MapViewer, ChartViewer, …)
  common/          Sidebar, Navbar, ProtectedRoute, Footer
  error/           ErrorBoundary (level prop: 'app' | 'page')
```

`Interactive/BlockRenderer` is the router for SSE `block` events. Each block type (markdown, code, chart, map, quiz, etc.) is a separate entity component in `Interactive/entities/`. Add new block types there.

### Path Aliases (vite.config.js)

```
@           → src
@components → src/components
@hooks      → src/hooks
@services   → src/services
@theme      → src/theme
@lib        → src/lib
@constants  → src/constants
@pages      → src/pages
```

### Testing

Vitest with `happy-dom` + MSW for API mocking. Tests live in `src/test/` and alongside components. Coverage threshold is 70% lines — `npm run test:cov` will fail below this.

`src/test/setup.js` starts the MSW service worker before each test suite. Add new API handlers to the MSW handlers file, not to individual test files.

### Performance Conventions

- All pages are `React.lazy()` — keep it that way
- Vendor chunk splitting is configured in `vite.config.js` (`vendor-react`, `vendor-mui`, `vendor-viz`, `vendor-editor`, `vendor-media`) — add new heavy deps to the appropriate chunk
- `@sentry/react` and Mermaid are dynamically imported at runtime to avoid blocking the initial parse
- Chunk size warning threshold: 600 KB

### Error Tracking (`src/lib/sentry.js`)

`initSentry()` is called in `main.jsx` before React mounts. Use `captureException(err)` for caught errors and `withSpan(name, op, fn)` to wrap async operations in Sentry performance spans. Both are no-ops when no DSN is configured (local dev). Sample rate is 10%.

---

## Studio — Deep Reference

### The Turn Object (Core Data Structure)

Every message in a conversation is a **turn**. Understanding the turn shape is required to work anywhere in Studio.

```js
{
  // Identity
  id:              string | null,   // null until server responds (temp phase)
  tempId:          string,          // always set — used as React key + DOM query target
  conversation_id: string,
  turn_index:      number,

  // Content source
  render_path:     'interactive' | 'video' | 'text',
  prompt:          string,
  title:           string,
  learningObjective: string | null,
  followUps:       string[],

  // Interactive render (render_path === 'interactive')
  blocks:          Block[],         // SSE block events, rendered by BlockRenderer

  // Video render (render_path !== 'interactive')
  framesData:      { images, captions, notes, suggested_followups, frame_count } | null,
  frame_count:     number,

  // Loading state
  isLoading:       boolean,         // true until 'meta' event; cleared on 'done'
  videoPhase:      'generating' | 'ready' | 'error' | 'disabled',

  // Synthesis (deep_research mode)
  synthesisText:   string,          // streamed token-by-token
  synthesisComplete: boolean,
  sources:         Source[],

  // Stage timeline (shown in LoadingView)
  stages:          Stage[],         // { id, label, status: 'active'|'done', duration_s }

  // Branching
  parentSessionId: string | null,   // links to parent turn for tree view
  parentFrameIndex: number | null,  // frame the user paused on before asking
}
```

**Three independent phase concepts — do not confuse them:**

| Field | Values | What it tracks |
|---|---|---|
| `videoPhase` | `generating` / `ready` / `error` / `disabled` | Video generation lifecycle |
| `render_path` | `interactive` / `video` / `text` | Type of content the backend produced |
| `stages[].status` | `active` / `done` | Individual SSE stage progress shown in LoadingView |

`render_path === 'interactive'` turns **always** have `videoPhase: 'disabled'` — they produce `blocks[]`, not video frames. Never attempt to render a FrameStrip for an interactive turn.

**Temp turns:** `createTempTurn()` in `studioUtils.js` creates the placeholder before the server responds. It sets `id: null`, `isLoading: true`, and either `videoPhase: 'generating'` or `'disabled'` based on the `videoEnabled` flag. The real `id` arrives in the SSE `done` event.

---

### Studio.jsx — Orchestrator

`Studio.jsx` owns the workspace. It **delegates all async logic to hooks** and only manages UI preferences and the `turns` array directly.

**State it owns:**
- `turns[]` — the full conversation history (passed down; never mutated outside Studio or its hooks)
- `prompt` / `setPrompt` — current input
- `selectedModel`, `selectedRenderMode`, `selectedMode` — generation preferences
- `stagedFiles[]` — files pending upload
- `viewMode` — `'chat'` | `'learn'` (full-screen learning takeover)
- `notesEnabled`, `videoEnabled` — persisted to localStorage on change

**Key memoized derived values** (recompute only when `turns` changes, not on prompt/viewMode changes):
- `isAnyGenerating` — `turns.some(t => t.isLoading)`
- `lastCompletedTurnId` — last turn with a real `id` (used as default `parentSessionId`)
- `isBootstrapping` — `!!bootstrap`

**Conversation switching cleanup** — when `activeConvId` changes, a `useEffect` atomically:
1. Aborts the current generation stream (`generationAbortRef.current?.abort()`)
2. Aborts the current load (`loadAbortRef.current?.abort()`)
3. Aborts all video streams (`abortAllVideoStreams()`)
4. Clears `turns`, `prompt`, `stagedFiles`, `bootstrap`

A separate ref `loadedConvIdRef` tracks which conversation is *actually loaded* (vs. what the URL says), preventing redundant fetches on re-renders.

**Tab-close warning** — a `beforeunload` listener is registered/deregistered on every render when `isAnyGenerating` is true. This is safe; the listener is always current.

**Mobile header injection** — `Studio.jsx` pushes `<StudioToolbar compact>` into the app header on small screens via `useMobileHeaderSlot()`. This avoids duplicating toolbar JSX. The slot is provided by `MobileHeaderSlotContext` in `App.jsx`.

---

### Conversation Loading (`src/hooks/useConversation.js`)

When `loadConversationById(convId)` is called:

1. Clears `turns`, scrolls to top, cancels any prior load
2. `GET /api/conversations/:convId` → raw turn array
3. For each turn, computes `videoPhase` from `{ video_path, status, render_path }`
4. Finalizes all stages (any `'active'` → `'done'`, since this is a historical load)
5. **Parallel frame metadata fetch** via `Promise.allSettled()` — one failure doesn't block others
   - `interactive` turns: runs `migrateOldSceneIR()` to convert old `{ explanation, entities }` format into `blocks[]`
   - Other turns: runs `normalizeFramesData()` to ensure `{ images, captions, notes, suggested_followups }` always exist
6. After all turns are loaded, resumes any `videoPhase === 'generating'` turn via `runVideoGenerationForTurn()` — this handles the case where the user left mid-generation

---

### Conversation Tree View (`src/components/Studio/ConversationMiniTree.jsx`)

**Visibility:** only renders when `turns.length > 1` AND at least one turn has a `parentSessionId` (real branching exists).

**Layout:** uses `dagre` to compute a DAG layout from `parentSessionId → id` edges. Positions are in SVG coordinates; the component sizes itself to the computed `{ width, height }`.

**Dot colours by `videoPhase`:**
- `ready` → green `#16a34a`
- `error` → red `#dc2626`
- `generating` → orange `#ea6a0a`
- anything else → light gray

**Navigation:** clicking a dot calls `onNavigate(turn.tempId)`. In `Studio.jsx`, `handleMiniTreeNavigate` uses `document.querySelector(`[data-turn-id="${tempId}"]`)` to scroll to the matching DOM node. Every turn card must render `data-turn-id={turn.tempId}` for this to work.

**Edges:** drawn as cubic Bézier curves with control points at the vertical midpoint between parent and child nodes.

---

### Pause-to-Ask Flow (`src/hooks/usePauseContext.js`)

This is how users ask questions about a specific video frame. `pauseContext` is a *pre-fill* for the **next** generation — it does not modify the current turn.

```
User pauses video → clicks "Ask about this"
  → handlePauseAsk({ sessionId, currentTime, duration, frameIndex, caption })
    → derives frameIndex from playback position if not passed
    → reads caption from turn.framesData.captions[frameIndex]
    → sets pauseContext = { sessionId, frameIndex, caption }
    → focuses prompt input

User types question → submits
  → useGeneration sends pauseContext as part of the API request
  → new turn is created with parentSessionId = sessionId, parentFrameIndex = frameIndex
  → pauseContext is cleared (setPauseContext(null)) at start of generation
```

`handlePauseAsk` has an **empty dependency array** but reads current turns through `turnsRef` (a ref kept in sync via `useEffect`). This is intentional — prevents `ConversationThread` from re-rendering when `turns` change.

`handleLearnAsk` (from the learning canvas) pre-fills both `pauseContext` and `prompt`, then switches to chat view. It delays `inputRef.current.focus()` by 120 ms to let the view transition complete.

---

### Video Stream Hook (`src/hooks/useVideoStream.js`)

Manages a `Map<tempId, AbortController>` for concurrent video streams. Key rules:

- `runVideoGenerationForTurn(tempId, sessionId, onDone?)` — starts a video SSE stream; `onDone` is always called in the `finally` block (even on abort), used to clear the bootstrap overlay
- `setTurnVideoPhase(tempId, sessionId, phase)` — matches by **either** `tempId` or `id` because phase can be set before or after the turn gets its real server ID
- `abortAll()` — called during conversation switch to kill all in-flight video streams
- An `AbortError` from `generateVideoStream()` is resolved (not rejected) — it is expected on navigation. The `catch` in `runVideoGenerationForTurn` is a safety net for unexpected errors only.

---

### Centralized Constants (`src/components/Studio/constants.js`)

All generation options live here. Import from this file — do not define models, modes, or render modes inline.

```js
MODELS          // 8 model options: auto, claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5,
                //   gpt-4.1, gpt-4o, gpt-4o-mini — each has { id, provider, model, label, short, description }
RENDER_MODES    // auto | manim | svg — each has { id, label, description, color, bg }
MODES           // instant | deep_research — each has { id, label, icon, desc }

INTENT_META     // intent type → { label, bg, text } for turn header chips
ACCENT_BY_INTENT // intent type → accent color string
FOLLOWUP_SUGGESTIONS // intent type → array of 4 follow-up prompt strings

DEFAULT_MODEL, DEFAULT_RENDER_MODE, DEFAULT_MODE  // used as initial useState values in Studio
```

**Helper functions also exported from constants.js:**
- `relativeTime(isoStr)` — ISO timestamp → `"5m ago"` / `"2h ago"` etc.
- `getFrameType(imagePath)` — extension check → `'image'` | `'video'` | `'placeholder'`
- `intentMeta(intentType)` — returns `INTENT_META[type]` or safe fallback

---

### Centralized Utilities (`src/components/Studio/studioUtils.js`)

Pure functions — no state, no side effects.

| Function | Purpose |
|---|---|
| `createTempTurn(opts)` | Factory for new turns before server responds — sets `id: null`, `isLoading: true` |
| `normalizeFramesData(data)` | Ensures `{ images, captions, notes, suggested_followups }` always exist (never null/undefined) |
| `migrateOldSceneIR(raw)` | Converts old `{ explanation, entities }` IR → `blocks[]` format for historical turns |
| `isTextTurn(turn)` | `render_path === 'interactive'` — these turns have no video |
| `getFrameCount(turn)` | `framesData.captions.length` preferred over `frame_count` field |
| `parseNotes(raw)` | Splits raw note text by newline, strips markdown list prefixes |
| `formatIntentType(str)` | `'concept_analogy'` → `'concept analogy'` |

`migrateOldSceneIR` is called in `useConversation` when loading historical interactive turns. It preserves the original `entity.id` values — these are referenced from other UI state, so they must not be regenerated.

---

### Ref-Based Patterns

Several hooks use refs to read latest state inside stable callbacks (avoiding stale closures without adding to dependency arrays):

| Ref | Location | Why |
|---|---|---|
| `turnsRef` | `usePauseContext` | `handlePauseAsk` needs current turns but must be stable (passed to memoized `ConversationThread`) |
| `loadedConvIdRef` | `Studio` + `useConversation` | Tracks which conversation is actually loaded vs. URL param |
| `firstTurnStagingRef` | `useGeneration` | Accumulates SSE data before the first turn exists in state |
| `generationAbortRef` | `useGeneration` | Allows navigation effect to abort without re-subscribing |
| `promptRef` | `useGeneration` | `handleGenerate` reads current prompt without it being a dependency (avoids re-creating the callback on every keystroke) |
| `videoAbortControllersRef` | `useVideoStream` | `Map<tempId, AbortController>` — mutable, should not trigger re-renders |

---

### SessionView (`src/components/Studio/SessionView.jsx`)

Renders a single completed turn. The outer component is memoized with a custom comparator comparing `session`, `videoPhase`, `framesData`, and `onPauseAsk` by reference.

- **FrameStrip** — horizontal scrollable thumbnail strip. Keyboard: `ArrowLeft`/`ArrowRight`. Auto-scrolls active thumb into view. Shows left/right gradient fade indicators when scrollable (threshold: 4 px to account for sub-pixel rounding).
- **SlideDialog** — full-screen frame viewer. Keyboard nav wired here too. Shows `"Ask about this"` only if the frame has a caption.
- **Frame type** — `getFrameType(imageUrl)` decides whether to render `<img>` or `<video>` for each frame.
- **Caption fallback** — if no image URL, renders caption text centered in a 16:9 ratio box (not a broken image).

---

### Data Flow Cheat Sheet

```
URL param :convId
  → Studio useEffect → loadConversationById()
      → api.getConversation() → raw turns
      → normalizeFramesData() / migrateOldSceneIR()  (studioUtils)
      → setTurns([...])
      → resume any videoPhase === 'generating' via runVideoGenerationForTurn()

User submits prompt
  → handleGenerate() in useGeneration
      → createTempTurn()  (studioUtils)  → optimistic turn added to state
      → api.generateStream() → SSE events
          stage/stage_done  → updates turn.stages[]
          meta              → populates turn.render_path, title, blocks: []
          block             → appends to turn.blocks[]
          frame             → appends to turn.pendingFrames[]
          done              → sets turn.id, isLoading: false
      → if videoEnabled: runVideoGenerationForTurn() starts in parallel
          done event → turn.videoPhase = 'ready' | 'error'

User clicks turn dot in ConversationMiniTree
  → onNavigate(turn.tempId)
  → document.querySelector([data-turn-id="${tempId}"]).scrollIntoView()

User pauses video → "Ask about this"
  → handlePauseAsk() → sets pauseContext = { sessionId, frameIndex, caption }
  → user submits → pauseContext attached to next handleGenerate() call
  → new turn.parentSessionId = sessionId → appears as branch in tree
```
