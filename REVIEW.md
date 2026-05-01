# Studio UI — Production Review Tracker

Issues are grouped by priority. Check off each one as we fix it.

---

## CRITICAL

### C1 — Generation logic duplicated in 3 places
- [x] **Status**: done — `startTurnStageTimers` and `buildRealTurn` extracted into `useGeneration.js`; all three handlers share them
- **Files**: `client/src/pages/Studio.jsx`
- **Problem**: `handleGenerate`, `handleLearnGenerate`, and `handleRetryGeneration` all independently set up the same stage-progress timeouts with hardcoded magic numbers (2500ms, 6000ms), build the same `realTurn` object, and handle errors the same way. Any change to the generation flow must be made in all three places.
- **Fix**: Extract `startStageTimers(tempId, enabled, setTurns)` as a shared utility. Extract `buildRealTurn(tempId, prompt, data, videoEnabled, parentCtx)` to build the turn object in one place. `handleGenerate` becomes a thin dispatcher that calls `runVideoGeneration` or `runInteractiveGeneration`.

---

### C2 — SSE stream reader copy-pasted in `api.js`
- [x] **Status**: done — `_readSSEStream(reader, onEvent)` extracted; both `generateVideoStream` and `interactiveGeneration` delegate to it
- **Files**: `client/src/services/api.js` lines 298–354 and 389–432
- **Problem**: `generateVideoStream` and `interactiveGeneration` implement identical SSE parsing logic: fetch → check response → reader loop → buffer split → `processLine` → `terminalSeen` guard → error surfacing. ~55 lines duplicated verbatim.
- **Fix**: Extract `async function _readSSEStream(reader, onEvent)` private helper inside `api.js`. Both endpoints call it instead of reimplementing the loop.

---

### C3 — `api.imageGeneration` has 10 positional parameters
- [x] **Status**: done — changed to a single options object `{ message, conversationId, pauseContext, notesEnabled, provider, model, signal, renderMode, parentSessionId, textOnly }`; all 3 call sites updated
- **Files**: `client/src/services/api.js` line 153, all call sites in `Studio.jsx`
- **Problem**: `imageGeneration(message, conversationId, pauseContext, notesEnabled, provider, model, signal, renderMode, parentSessionId, textOnly)`. Call sites pass `null` positionally — easy to swap args silently. Adding a new parameter in the middle breaks every call site.
- **Fix**: Change to a single options object: `imageGeneration({ message, conversationId, pauseContext, notesEnabled, provider, model, signal, renderMode, parentSessionId, textOnly })`. Update all 3 call sites in Studio.jsx.

---

### C4 — `Studio.jsx` is a God Component (~800 lines, 15+ state variables)
- [x] **Status**: done — split into `useVideoStream.js`, `usePauseContext.js`, `useConversation.js`, `useGeneration.js`; Studio.jsx reduced to ~330 lines of orchestration + JSX
- **Files**: `client/src/pages/Studio.jsx`
- **Problem**: Owns conversation loading, two generation pipelines (video + interactive), video SSE streaming, stage-progress animations, bootstrap flow, retry logic, pause context, follow-up derivation, view-mode switching, keyboard shortcuts, and all rendering. Untestable as-is; every feature change risks regressions in an unrelated flow.
- **Fix**: Split into focused custom hooks:
  - `useConversation.js` — turn loading, conversation switching, bootstrap state
  - `useGeneration.js` — handleGenerate, handleLearnGenerate, handleRetryGeneration
  - `useVideoStream.js` — runVideoGenerationForTurn, handleRetryTurn, abort management
  - `usePauseContext.js` — pauseContext, handlePauseAsk, handleLearnAsk
  - `Studio.jsx` reduces to ~150 lines of orchestration + JSX only

---

## IMPORTANT

### I1 — `turns` array scanned on every render for derived values
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` lines 312, 329, 483
- **Problem**: `turns.some((t) => t.isLoading)` and `turns.filter((t) => t.id).at(-1)` run on every render. `isAnyGenerating` useMemo re-runs on every turn update. Fine now; painful at 100+ turns.
- **Fix**: Memoize `isAnyGenerating` and `lastCompletedTurnId`. Longer term: use a `Map<tempId, turn>` instead of array for O(1) updates; convert to array only for rendering.

---

### I2 — Bootstrap state spread across 4 separate variables
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` lines 66–70
- **Problem**: `isBootstrapping`, `bootstrapStage`, `bootstrapPrompt`, `bootstrapFrames` always change together but are set in sequence causing 3–4 extra re-renders. If something throws between two setters, the UI can get stuck.
- **Fix**: Merge into one object:
  ```js
  const [bootstrap, setBootstrap] = useState(null)
  // null = idle
  // { stage: 'planning'|'generating'|'rendering'|'frames'|'video', prompt, frames }
  setBootstrap({ stage: 'planning', prompt: submittedPrompt, frames: null })
  setBootstrap(null) // clear
  ```

---

### I3 — `FrameStrip` component duplicated in 3 files
- [ ] **Status**: open
- **Files**:
  - `client/src/components/Studio/SessionView.jsx` line 35 (full: scroll indicators, keyboard nav, expand)
  - `client/src/components/Studio/LearningView/NodeModal.jsx` line 15 (simplified)
- **Problem**: Accessibility fixes (keyboard nav) and visual changes must be applied to all copies separately. They've already drifted — the NodeModal version has no keyboard navigation.
- **Fix**: Create `client/src/components/Studio/FrameStrip.jsx` as a shared component. Accept a `compact` prop to skip scroll indicators. Delete the duplicate implementations.

---

### I4 — `useFlowData` has missing dependencies in its `useMemo`
- [ ] **Status**: open
- **Files**: `client/src/components/Studio/LearningView/useFlowData.js` line 27
- **Problem**: `onAsk`, `defaultModel`, and `defaultVideoEnabled` are passed into the memo but only `turns` is in the deps array. When the user changes the model in Studio without generating a new turn, the AskNode ghost panels get stale `defaultModel` values because the memo doesn't re-run.
- **Fix**: Use refs for the stable-identity values that shouldn't trigger dagre re-layout:
  ```js
  const onAskRef = useRef(onAsk)
  useEffect(() => { onAskRef.current = onAsk }, [onAsk])
  // useMemo depends on [turns, defaultVideoEnabled] — refs don't need to be deps
  ```

---

### I5 — Stale closure for `resolvedConvId` in interactive generation
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` line 367
- **Problem**: `let resolvedConvId = activeConvId` is mutated inside the SSE event callback via closure. Works today because it's read after the `await` completes, but it's subtle — a future developer moving `onActiveConvIdChange` inside the event handler would break it silently.
- **Fix**: Use a ref: `const resolvedConvIdRef = useRef(activeConvId)`. Set `resolvedConvIdRef.current = event.conversation_id` inside the callback. Read `resolvedConvIdRef.current` after the await.

---

### I6 — `loadConversationByIdRef` pattern is a workaround for a design problem
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` lines 272–273
- **Problem**: The ref-assignment trick (`loadConversationByIdRef.current = loadConversationById`) is needed to break a stale closure cycle. It works but obscures intent and is a symptom that `loadConversationById` closes over too much state.
- **Fix**: Properly addressed when `useConversation.js` hook is extracted (see C4). The hook owns the load function and the effect, so the ref trick is no longer needed.

---

### I7 — `NodeModal` re-fetches framesData on every open even when data exists
- [ ] **Status**: open
- **Files**: `client/src/components/Studio/LearningView/NodeModal.jsx` line 113
- **Problem**: Condition `if (node.framesData?.captions?.length)` triggers a fresh API call whenever captions is empty — including text-only sessions where notes may be populated but captions are intentionally empty. Every click on a text node hits the network.
- **Fix**:
  ```js
  if (node.framesData) {
    setFramesData(node.framesData)  // use cached data even if captions is empty
  } else {
    api.getFramesMeta(node.id).then(...)
  }
  ```

---

### I8 — `textMode` leaks into permanent turn shape but is only a loading hint
- [ ] **Status**: open
- **Files**: `client/src/components/Studio/studioUtils.js` line 57, `client/src/components/Studio/ConversationThread.jsx`
- **Problem**: `createTempTurn` stores `textMode: !videoEnabled` on every turn. This field is only meaningful during the loading phase (passed to `<LoadingView textMode={turn.textMode} />`), but it persists on every real turn forever.
- **Fix**: Remove `textMode` from `createTempTurn`. Compute at callsite: `textMode={turn.videoPhase === 'disabled'}` in `ConversationThread.jsx`. Confirmed `textMode` is only used in one place.

---

## NICE-TO-HAVE

### N1 — Model and render mode preferences not persisted across sessions
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` lines 59–60
- **Problem**: `videoEnabled` is persisted in localStorage; `selectedModel` and `selectedRenderMode` are not. Users who always use a specific model must re-select it on every page load.
- **Fix**: Same pattern as `videoEnabled`:
  ```js
  const [selectedModel, setSelectedModel] = useState(
    () => MODELS.find(m => m.id === localStorage.getItem('studio-model')) ?? DEFAULT_MODEL
  )
  ```

---

### N2 — `viewMode === 'learn'` should be a route, not component state
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` line 648
- **Problem**: The learning canvas is a full-screen takeover rendered via `if (viewMode === 'learn') return <LearningView />`. Browser back button doesn't exit the canvas. Deep-linking to the canvas is impossible. URL doesn't change, so refreshing drops the user back to chat view.
- **Fix**: Make `/studio/:convId/learn` a route. The back button becomes a real navigation action. This is a product decision and touches the router setup, so it's a planned refactor, not an emergency.

---

### N3 — `isBootstrapping` / `showEmpty` / `showThread` boolean arithmetic is hard to read
- [ ] **Status**: open
- **Files**: `client/src/pages/Studio.jsx` lines 484–487
- **Problem**:
  ```js
  const showEmpty  = !isBootstrapping && turns.length === 0
  const showLoader = isBootstrapping
  const showThread = !isBootstrapping && turns.length > 0
  ```
  Three mutually-exclusive boolean variables computed and named individually. As more states are added this becomes error-prone.
- **Fix**: One derived enum:
  ```js
  const viewState = isBootstrapping ? 'loading' : turns.length === 0 ? 'empty' : 'thread'
  ```

---

### N4 — `migrateOldSceneIR` — confirm whether it is still needed
- [ ] **Status**: open
- **Files**: `client/src/components/Studio/studioUtils.js` line 29
- **Problem**: Migration function for sessions saved before the `blocks[]` IR format. If the backend now always returns `blocks[]`, this can be deleted. If it's still needed, confirm it's called in all code paths that load old sessions.
- **Fix**: Grep for all callsites. If none exist (or the backend has migrated all old data), delete the function.

---

## How to use this file

Work through issues in order: Critical → Important → Nice-to-have. Mark `[x]` when done. Each fix is independent enough to be a separate PR. C3 (`imageGeneration` options object) should be done before C1 (consolidating generation handlers) since C1 cleanup will call C3's new signature.
