# studio-hook

You are extracting a cohesive block of state and logic from `Studio.jsx` into a custom hook. Studio.jsx currently mixes conversation loading, video generation, bootstrap staging, pause context management, and submission logic — all inline. This skill guides extracting one block at a time without regressions.

---

## When to use this skill

Use when Studio.jsx exceeds ~300 lines, when you need to reuse a piece of Studio logic elsewhere, or when testing a specific behaviour becomes difficult because everything is tangled together.

---

## Rules for all hook extractions

- Hooks are **pure functions** — no JSX, no `return <div />`
- File naming: `use<Purpose>.js` (camelCase), placed in `client/src/hooks/`
- Create `client/src/hooks/` if it doesn't exist yet
- Callback functions returned by the hook must be wrapped in `useCallback` with correct dependencies — avoid stale closures
- Memoized values returned by the hook must use `useMemo` where recomputation is expensive
- All `useEffect` dependency arrays must be complete — ESLint's `exhaustive-deps` rule must pass
- After extraction, Studio.jsx should shrink by at least 30 lines per hook
- Only one extraction per task — don't refactor everything at once

---

## Candidate 1 — `useConversationLoader`

**What it owns:**

| State / ref | Description |
|---|---|
| `turns` | Array of conversation turns |
| `isBootstrapping` | True during first-turn generation |
| `bootstrapStage` | `'idle' \| 'planning' \| 'rendering' \| 'done'` |
| `bootstrapPrompt` | The prompt used for the bootstrapping turn |
| `loadedConvIdRef` | Prevents duplicate loads on the same convId |

**Logic to extract:**
- `loadConversationById(convId)` — fetches conversation, maps turns, sets state
- `useEffect` that calls `loadConversationById` when `activeConvId` changes

**Hook signature:**

```js
// client/src/hooks/useConversationLoader.js
import { useState, useRef, useCallback, useEffect } from 'react'
import { api } from '../services/api'

export function useConversationLoader(activeConvId, onError) {
  const [turns, setTurns] = useState([])
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [bootstrapStage, setBootstrapStage] = useState('idle')
  const loadedConvIdRef = useRef(null)

  const loadConversationById = useCallback(async (convId) => {
    // ... extracted logic
  }, [onError])

  useEffect(() => {
    if (!activeConvId) return
    loadConversationById(activeConvId)
  }, [activeConvId, loadConversationById])

  return {
    turns,
    setTurns,
    isBootstrapping,
    setIsBootstrapping,
    bootstrapStage,
    setBootstrapStage,
    loadConversationById,
  }
}
```

**Usage in Studio.jsx:**

```jsx
const {
  turns, setTurns,
  isBootstrapping, setIsBootstrapping,
  bootstrapStage,
  loadConversationById,
} = useConversationLoader(activeConvId, (msg) => toast.error(msg))
```

---

## Candidate 2 — `useVideoGeneration`

**What it owns:**

| Logic | Description |
|---|---|
| `setTurnVideoPhase(turnId, phase)` | Updates `videoPhase` on a specific turn in `turns[]` |
| `runVideoGenerationForTurn(turn)` | Calls `api.generateVideoStream`, handles SSE events, updates phase |
| `handleRetryTurn(turn)` | Resets phase to `'generating'`, re-runs `runVideoGenerationForTurn` |

**Hook signature:**

```js
// client/src/hooks/useVideoGeneration.js
import { useCallback } from 'react'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'

export function useVideoGeneration(setTurns) {
  const toast = useToast()

  const setTurnVideoPhase = useCallback((turnId, phase) => {
    setTurns(prev => prev.map(t => t.id === turnId ? { ...t, videoPhase: phase } : t))
  }, [setTurns])

  const runVideoGenerationForTurn = useCallback(async (turn) => {
    // ... extracted SSE logic
  }, [setTurnVideoPhase, toast])

  const handleRetryTurn = useCallback((turn) => {
    setTurnVideoPhase(turn.id, 'generating')
    runVideoGenerationForTurn(turn)
  }, [setTurnVideoPhase, runVideoGenerationForTurn])

  return { runVideoGenerationForTurn, handleRetryTurn }
}
```

**Usage in Studio.jsx:**

```jsx
const { runVideoGenerationForTurn, handleRetryTurn } = useVideoGeneration(setTurns)
```

Note: `setTurns` comes from `useConversationLoader` if that hook was extracted first.

---

## Candidate 3 — `usePauseContext`

**What it owns:**

| State | Description |
|---|---|
| `pauseContext` | `{ sessionId, frameIndex, caption } \| null` |

**Logic:**
- `setPauseContext` — stores pause context
- `clearPauseContext` — sets to null
- Auto-clear when `activeConvId` changes (prevent stale context leaking to new conversation)

**Hook signature:**

```js
// client/src/hooks/usePauseContext.js
import { useState, useEffect } from 'react'

export function usePauseContext(activeConvId) {
  const [pauseContext, setPauseContext] = useState(null)

  // Clear when switching conversations
  useEffect(() => {
    setPauseContext(null)
  }, [activeConvId])

  return { pauseContext, setPauseContext, clearPauseContext: () => setPauseContext(null) }
}
```

**Usage in Studio.jsx:**

```jsx
const { pauseContext, setPauseContext, clearPauseContext } = usePauseContext(activeConvId)
```

---

## Extraction procedure

Follow this order to avoid breaking Studio.jsx:

1. **Copy** the target state/logic into the new hook file
2. **Add** the hook call to Studio.jsx, destructuring everything the hook returns
3. **Remove** the original state declarations and logic from Studio.jsx (one block at a time)
4. **Fix** any remaining references — make sure Studio.jsx uses the hook's return values
5. **Run lint:** `cd client && npm run lint` — fix all errors before proceeding
6. **Manual test:**
   - Load an existing conversation — turns render correctly
   - Submit a new prompt — generation, video, and follow-ups work
   - Switch conversations — pause context clears, correct turns load
   - Retry a failed video — retry flow still works

---

## Self-verification checklist

- [ ] Hook file is in `client/src/hooks/use<Purpose>.js`
- [ ] Hook is a plain function (no JSX, no class)
- [ ] All `useCallback`/`useMemo` have correct dependency arrays
- [ ] All `useEffect` dependency arrays are complete (ESLint exhaustive-deps passes)
- [ ] Studio.jsx is shorter after extraction (not just reorganised)
- [ ] `npm run lint` passes with zero new errors
- [ ] Manual test: existing conversation loads, new generation works, video retry works
