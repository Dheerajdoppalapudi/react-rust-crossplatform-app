# Zenith — Client

React + Vite frontend for the Zenith AI visual learning studio.

---

## Project structure

```
client/
├── src/
│   ├── components/
│   │   ├── common/          # App-wide UI: Sidebar
│   │   ├── error/           # ErrorBoundary (layered: app / page / component)
│   │   └── Studio/          # All studio-specific components
│   │       ├── LearningView/    # Canvas-based learning flow (ReactFlow)
│   │       ├── constants.js     # MODELS, INTENT_META, FOLLOWUP_SUGGESTIONS, utils
│   │       ├── ConversationThread.jsx
│   │       ├── SessionView.jsx
│   │       ├── VideoPanel.jsx
│   │       ├── FrameThumbnail.jsx
│   │       ├── FrameStrip.jsx
│   │       ├── LoadingView.jsx
│   │       ├── EmptyView.jsx
│   │       ├── PromptBar.jsx
│   │       └── NotesPanel.jsx
│   ├── contexts/
│   │   └── ToastContext.jsx  # Queue-based toast system + useToast hook
│   ├── pages/
│   │   ├── Studio.jsx        # Main page — owns all conversation state
│   │   ├── AboutUs.jsx
│   │   └── Settings.jsx
│   ├── services/
│   │   └── api.js            # All API calls — single source of truth for endpoints
│   ├── App.jsx               # Theme, routing, ErrorBoundary wiring, ToastProvider
│   └── main.jsx              # Entry point — global ErrorBoundary
├── index.html                # Google Fonts (Sora) loaded here
└── package.json
```

---

## Dev commands

```bash
npm install       # install dependencies
npm run dev       # start Vite dev server (http://localhost:5173)
npm run build     # production build → dist/
npm run lint      # ESLint
npm run preview   # preview the production build locally
```

Backend must be running on `http://localhost:8000` (or set `VITE_API_URL` env var).

---

## Architecture

### State ownership

- **`App.jsx`** owns `conversations[]` and `activeConvId` — lifted so Sidebar and Studio stay in sync without prop drilling through the router.
- **`Studio.jsx`** owns all per-session state: `turns[]`, `prompt`, `selectedModel`, `pauseContext`, `isBootstrapping`. It never fetches conversations directly — it calls `onConversationsRefresh()` (passed from App) after a successful generation.
- **`PromptBar`** is a pure controlled component — no internal state except the model dropdown menu anchor.

### Error boundaries (layered)

Three levels, each with an appropriate fallback UI:

| Level | Where used | Fallback |
|---|---|---|
| `app` | `main.jsx` wraps entire tree | Full-screen reload page |
| `page` | `App.jsx` wraps `<Routes>` | Content-area error, sidebar stays |
| `component` | Each conversation turn in `ConversationThread` | Inline error card with retry |

Use `<ErrorBoundary level="component">` around any subtree that could receive bad data from the API. The `fallback` render prop allows custom fallback UI per use case.

### Toast notifications

```js
import { useToast } from '../contexts/ToastContext'

const toast = useToast()
toast.success('Downloaded.')
toast.error('Could not load conversation.')
toast.info('Generating…', { duration: 8000 })
toast.warning('API key missing.')
```

- Must be used inside `<ToastProvider>` (mounted in `App.jsx`).
- Max 3 toasts visible; oldest is dropped when limit is exceeded.
- Auto-dismiss: 4s (success/info), 5s (warning), 7s (error).
- `aria-live="polite"` region — screen readers announce new toasts.

### Model selection

Models are defined in `src/components/Studio/constants.js` as the `MODELS` array. Each entry is `{ id, provider, model, label, short, description }`. `DEFAULT_MODEL` is `MODELS[0]`.

Adding a new model: add one object to `MODELS`. The UI dropdown and API call update automatically.

### API layer (`src/services/api.js`)

All `fetch` calls live here. Components never call `fetch` directly. The primary call for generation is:

```js
api.imageGeneration(prompt, conversationId, pauseContext, notesEnabled, provider, model)
```

`provider` is `'claude'` or `'openai'`; `model` is the exact model string (e.g. `'claude-sonnet-4-6'`).

---

## Key patterns

### Video retry flow

When `turn.videoPhase === 'error'` and `turn.id` exists, `ConversationThread` renders a `RetryBanner`. Clicking it calls `onRetryTurn(turn)` in `Studio.jsx`, which resets `videoPhase` to `'generating'` and re-runs `runVideoGenerationForTurn`.

### Pause-to-ask

When the user pauses the video, a chip appears ("Ask about this moment"). Clicking it calls `onPauseAsk` with `{ sessionId, currentTime, duration }`. Studio derives the `frameIndex` and stores `pauseContext`. The next generation includes the pause context so the LLM has frame-specific context.

Pause context is always cleared when `activeConvId` changes — prevents stale context being sent to a different conversation.

### Keyboard shortcuts (Sidebar)

| Shortcut (Mac) | Shortcut (Windows) | Action |
|---|---|---|
| `⇧⌘O` | `Ctrl+Shift+O` | New chat |
| `⌘K` | `Ctrl+K` | Focus search (opens sidebar if collapsed) |

Platform detected via `navigator.platform`. Handler registered as a `window` keydown listener in `Sidebar.jsx`.

### Follow-up suggestions

Rendered in the **scrollable content area** of `Studio.jsx`, not inside `PromptBar`. They appear after the last turn ends and align to the same `maxWidth: 760` column as the conversation content. Source priority: LLM-generated `suggested_followups` from the API response → `FOLLOWUP_SUGGESTIONS[intent_type]` fallback.

### Frame strip accessibility

The frame strip in `SessionView` is `role="listbox"` with `tabIndex={0}`. `ArrowLeft`/`ArrowRight` navigate frames; the active thumbnail auto-scrolls into view. Left/right fade gradients appear when there is overflow content in that direction.

---

## Theming

Theme is built in `App.jsx` via `buildTheme(mode)` and toggled at runtime. Stored in `localStorage` under `zenith-theme`.

- Font: **Sora** (loaded from Google Fonts in `index.html`)
- Primary: `#4F6EFF` (dark) / `#001AFF` (light)
- Background: `#111111` / `#f8fafc`
- Paper: `#1a1a1a` / `#ffffff`

All component styles use MUI `sx` props against the theme tokens — never hardcoded colours except where intentional (e.g. video player overlay `rgba(0,0,0,0.55)`).

---

## Deployment

CI/CD via `.github/workflows/deploy.yml`:
- Frontend: `npm ci` → `npm run build` → sync `dist/` to S3 → CloudFront invalidation
- Requires secrets: `VITE_API_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`
