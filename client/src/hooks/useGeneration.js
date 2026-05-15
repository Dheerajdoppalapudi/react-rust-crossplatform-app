import { useRef, useCallback, useEffect } from 'react'
import { api } from '../services/api'
import { createTempTurn, normalizeFramesData } from '../components/Studio/studioUtils'
import { withSpan } from '../lib/sentry.js'

// ── Stage array helpers ───────────────────────────────────────────────────────

function _applyStage(stages, event) {
  const exists = stages.find(s => s.id === event.stage)
  const extra  = event.queries ? { queries: event.queries } : {}
  return exists
    ? stages.map(s => s.id === event.stage
        ? { ...s, status: 'active', label: event.label ?? s.label, ...extra }
        : s)
    : [...stages, { id: event.stage, label: event.label ?? event.stage, status: 'active', ...extra }]
}

function _applyStageDone(stages, event) {
  return stages.map(s =>
    s.id === event.stage ? { ...s, status: 'done', duration_s: event.duration_s } : s
  )
}

// Mark every still-active stage as done — called defensively on stream completion
// so any stage that never received stage_done (backend bug / missing event) is finalized.
function _finalizeAllStages(stages) {
  return stages.map(s => s.status === 'active' ? { ...s, status: 'done' } : s)
}

// ── SSE reducers ──────────────────────────────────────────────────────────────
// Pure functions: (state, event) → newState
// Used by both handleGenerate (via dispatch) and createTurnSSEHandler.
// Adding a new streaming event = one entry here + one case in the SSE router.

const SSE_REDUCERS = {
  stage:          (s, e) => ({ ...s, stages:           _applyStage(s.stages ?? [], e) }),
  stage_done:     (s, e) => ({ ...s, stages:           _applyStageDone(s.stages ?? [], e) }),
  source:         (s, e) => ({ ...s, sources:          [...(s.sources ?? []), e.source] }),
  token:          (s, e) => ({ ...s, synthesisText:    (s.synthesisText ?? '') + e.text }),
  synthesis_done: (s, e) => ({ ...s, synthesisComplete: true, sources: e.sources ?? s.sources ?? [] }),
  beats_planned:  (s, e) => ({ ...s, beatTitles:       e.beat_titles ?? [], completedBeats: [] }),
  beat_ready:     (s, e) => ({ ...s, completedBeats:   [...(s.completedBeats ?? []), e.beat_index] }),
  block:          (s, e) => ({ ...s, blocks:           [...(s.blocks ?? []), e.block] }),
}

// ── Shared SSE handler for follow-up / retry / learn turns ───────────────────
// Handles all reducer-driven events plus meta, done, error.
// No first-turn branching needed — only handleGenerate needs that.

function createTurnSSEHandler(id, { setTurns, toast, donePayloadRef }) {
  return function handleEvent(event) {
    const reducer = SSE_REDUCERS[event.type]
    if (reducer) {
      setTurns(prev => prev.map(t => t.tempId === id ? reducer(t, event) : t))
      return
    }
    switch (event.type) {
      case 'meta':
        setTurns(prev => prev.map(t => t.tempId === id ? {
          ...t,
          render_path: 'interactive', isLoading: true,
          title: event.title ?? '', followUps: event.follow_ups ?? [],
          learningObjective: event.learning_objective ?? null, blocks: [],
        } : t))
        break
      case 'done':
        donePayloadRef.current = event
        setTurns(prev => prev.map(t => t.tempId === id
          ? { ...t, stages: _finalizeAllStages(t.stages ?? []) }
          : t
        ))
        break
      case 'error':
        toast.error(event.message || 'Generation failed. Please try again.')
        setTurns(prev => prev.map(t => t.tempId === id
          ? { ...t, isLoading: false, videoPhase: 'error' }
          : t
        ))
        break
    }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGeneration({
  // Conversation context
  activeConvId,
  loadedConvIdRef,
  onActiveConvIdChange,
  onConversationsRefresh,
  // Derived from turns (memoized in Studio.jsx)
  isAnyGenerating,
  lastCompletedTurnId,
  setTurns,
  // Prompt
  prompt,
  setPrompt,
  // Generation preferences
  videoEnabled,
  notesEnabled,
  selectedModel,
  selectedRenderMode,
  selectedMode  = null,   // { id: 'instant' | 'deep_research', label, icon }
  stagedFiles   = null,   // Array<{ id, name, type }> | null
  // Pause context
  pauseContext,
  setPauseContext,
  // Bootstrap overlay
  setBootstrap,
  // Video stream
  runVideoGenerationForTurn,
  // UI helpers
  scrollToTop,
  toast,
}) {
  const generationIdRef    = useRef(0)
  const generationAbortRef = useRef(null)
  const lastSubmitRef      = useRef(0)
  // Staging buffer for the first turn — accumulates SSE state before the turn
  // row exists in state (turns starts as []). Carried forward into the turn on meta/done.
  const stagingRef = useRef({
    stages: [], sources: [], synthesisText: '', synthesisComplete: false,
    beatTitles: null, completedBeats: null,
  })

  const promptRef = useRef(prompt)
  useEffect(() => { promptRef.current = prompt })

  // ── handleGenerate ────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const currentPrompt = promptRef.current
    if (!currentPrompt.trim() || isAnyGenerating) return

    const now = Date.now()
    if (now - lastSubmitRef.current < 1_000) return
    lastSubmitRef.current = now

    const submittedPrompt = currentPrompt.trim()
    setPrompt('')

    await withSpan('generate', 'ui.action', async () => {

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    stagingRef.current = {
      stages: [], sources: [], synthesisText: '', synthesisComplete: false,
      beatTitles: null, completedBeats: null,
    }

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    const parentSessionId = isFirstTurn
      ? null
      : (pauseContext?.sessionId ?? lastCompletedTurnId)

    const capturedPauseContext = pauseContext
    setPauseContext(null)

    const researchMode    = selectedMode?.id ?? 'instant'
    const renderModeId    = selectedRenderMode?.id !== 'auto' ? selectedRenderMode?.id : null
    const uploadedFileIds = stagedFiles?.length ? stagedFiles.map(f => f.id).join(',') : null

    // ── Optimistic UI ─────────────────────────────────────────────────────────
    if (isFirstTurn) {
      setBootstrap({
        stage: 'planning',
        prompt: submittedPrompt,
        stages: [],   // SSE stages populate in arrival order; fallback shows via `stage` prop
      })
      setTurns([])
      scrollToTop()
    } else {
      setTurns((prev) => [...prev, {
        ...createTempTurn({
          tempId,
          prompt:           submittedPrompt,
          videoEnabled,
          parentSessionId,
          parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
        }),
        stages:            [],
        sources:           [],
        synthesisText:     '',
        synthesisComplete: false,
        // Pre-declare render_path for non-video so the loading view knows what's coming
        ...(videoEnabled ? {} : { render_path: 'interactive', title: '', followUps: [], blocks: [] }),
      }])
    }

    // Mutable tracking objects — mutated inside the SSE callback, read post-stream
    const resolvedConvId = { current: activeConvId }
    const donePayload    = { current: null }

    // dispatch: applies a reducer to staging ref, bootstrap, and turns in one call.
    // This is the single place that syncs all three state sinks for reducer-handled events.
    function dispatch(event) {
      const reducer = SSE_REDUCERS[event.type]
      if (!reducer) return
      stagingRef.current = reducer(stagingRef.current, event)
      if (isFirstTurn) setBootstrap(b => b ? reducer(b, event) : b)
      setTurns(prev => prev.map(t => t.tempId === tempId ? reducer(t, event) : t))
    }

    try {
      await api.generateStream(
        {
          message:         submittedPrompt,
          conversationId:  activeConvId,
          pauseContext:    capturedPauseContext,
          notesEnabled,
          provider:        selectedModel.provider,
          model:           selectedModel.model,
          renderMode:      renderModeId,
          parentSessionId,
          videoEnabled,
          researchMode,
          uploadedFileIds,
        },
        (event) => {
          if (isStale()) return

          // Reducer-handled events: delegate to dispatch (updates staging + bootstrap + turns)
          if (SSE_REDUCERS[event.type]) {
            dispatch(event)
            return
          }

          switch (event.type) {
            case 'init': {
              if (isFirstTurn) {
                resolvedConvId.current = event.conversation_id
              }
              break
            }
            case 'meta': {
              const turnData = {
                render_path:       'interactive',
                isLoading:         true,
                title:             event.title ?? '',
                followUps:         event.follow_ups ?? [],
                learningObjective: event.learning_objective ?? null,
                blocks:            [],
              }
              if (isFirstTurn) {
                const staging = stagingRef.current
                setTurns([{
                  tempId, id: null, prompt: submittedPrompt,
                  stage: null, framesData: null, videoPhase: 'disabled',
                  parentSessionId,
                  parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
                  // Carry forward all staged data buffered before meta arrived
                  stages:            staging.stages,
                  sources:           staging.sources,
                  synthesisText:     staging.synthesisText,
                  synthesisComplete: staging.synthesisComplete,
                  beatTitles:        staging.beatTitles,
                  completedBeats:    staging.completedBeats,
                  ...turnData,
                }])
                setBootstrap(null)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId ? { ...t, ...turnData } : t))
              }
              break
            }
            case 'frame': {
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, pendingFrames: [...(t.pendingFrames ?? []), { index: event.index, caption: event.caption }] }
                : t
              ))
              break
            }
            case 'done': {
              resolvedConvId.current = event.conversation_id ?? resolvedConvId.current
              donePayload.current    = event
              if (isFirstTurn) {
                stagingRef.current = { ...stagingRef.current, stages: _finalizeAllStages(stagingRef.current.stages) }
              }
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, stages: isFirstTurn
                    ? stagingRef.current.stages
                    : _finalizeAllStages(t.stages ?? []) }
                : t
              ))
              break
            }
            case 'error': {
              toast.error(event.message || 'Generation failed. Please try again.')
              if (isFirstTurn) {
                setBootstrap(null)
                setTurns([])
                onActiveConvIdChange(null)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, isLoading: false, videoPhase: 'error' }
                  : t
                ))
              }
              break
            }
          }
        },
        genController.signal,
      )

      // ── Post-stream ────────────────────────────────────────────────────────
      if (genController.signal.aborted) {
        if (isFirstTurn) {
          setBootstrap(null)
          setTurns([])
        } else {
          setTurns(prev => prev.filter(t => t.tempId !== tempId))
        }
        return
      }

      const done = donePayload.current
      if (!done) return   // stream ended without done — error already surfaced via 'error' event

      if (isFirstTurn) {
        loadedConvIdRef.current = done.conversation_id
        onActiveConvIdChange(done.conversation_id)

        if (videoEnabled) {
          const framesData = normalizeFramesData(done)
          setBootstrap(b => b ? { ...b, stage: 'frames', frames: { framesData, sessionId: done.session_id } } : b)
          setTurns([{
            tempId, id: done.session_id,
            conversation_id:   done.conversation_id,
            turn_index:        done.turn_index,
            prompt:            submittedPrompt,
            intent_type:       done.intent_type,
            render_path:       done.render_path,
            frame_count:       done.frame_count,
            isLoading:         false,
            stage:             null,
            framesData,
            videoPhase:        'generating',
            parentSessionId,
            parentFrameIndex:  capturedPauseContext?.frameIndex ?? null,
            stages:            stagingRef.current.stages,
            sources:           stagingRef.current.sources,
            synthesisText:     stagingRef.current.synthesisText,
            synthesisComplete: stagingRef.current.synthesisComplete,
            beatTitles:        stagingRef.current.beatTitles,
            completedBeats:    stagingRef.current.completedBeats,
          }])
        } else {
          // meta/block events already built the turn — finalize it
          setTurns(prev => prev.map(t => t.tempId === tempId ? {
            ...t, isLoading: false, id: done.session_id,
            conversation_id: done.conversation_id, turn_index: done.turn_index,
            intent_type: done.intent_type, render_path: done.render_path,
          } : t))
          setBootstrap(null)
        }
      } else {
        setTurns(prev => prev.map(t => t.tempId === tempId ? {
          ...t,
          isLoading:       false,
          id:              done.session_id,
          conversation_id: done.conversation_id,
          turn_index:      done.turn_index,
          intent_type:     done.intent_type,
          render_path:     done.render_path,
          frame_count:     done.frame_count ?? t.frame_count,
          ...(videoEnabled ? {
            framesData:  normalizeFramesData(done),
            videoPhase:  'generating',
          } : {}),
        } : t))
      }

      await onConversationsRefresh()

      if (videoEnabled) {
        if (isFirstTurn) {
          setBootstrap(b => b ? { ...b, stage: 'video' } : b)
          runVideoGenerationForTurn(tempId, done.session_id, () => setBootstrap(null))
        } else {
          runVideoGenerationForTurn(tempId, done.session_id)
        }
      }

    } catch (err) {
      if (genController.signal.aborted) {
        if (isFirstTurn) {
          setBootstrap(null)
          setTurns([])
          onActiveConvIdChange(null)
        } else {
          setTurns(prev => prev.filter(t => t.tempId !== tempId))
        }
        return
      }
      console.error('[Studio] handleGenerate:', err)
      toast.error('Generation failed. Please try again.')
      if (isFirstTurn) {
        setBootstrap(null)
        setTurns([])
        onActiveConvIdChange(null)
      } else {
        setTurns(prev => prev.map(t =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    }

    }) // end withSpan
  }, [
    isAnyGenerating, lastCompletedTurnId, activeConvId, notesEnabled, videoEnabled,
    pauseContext, selectedModel, selectedRenderMode, selectedMode, stagedFiles,
    onActiveConvIdChange, onConversationsRefresh, runVideoGenerationForTurn,
    scrollToTop, toast, loadedConvIdRef, setBootstrap, setPauseContext, setPrompt, setTurns,
  ])

  // ── handleLearnGenerate ───────────────────────────────────────────────────

  const handleLearnGenerate = useCallback(async ({
    question,
    sessionId,
    model:        askModel,
    videoEnabled: askVideoEnabled,
  }) => {
    if (!activeConvId || !question.trim()) return

    const effectiveModel        = askModel        ?? selectedModel
    const effectiveVideoEnabled = askVideoEnabled  ?? videoEnabled

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const tempId   = `temp_${Date.now()}`
    const pauseCtx = { sessionId, frameIndex: undefined, caption: undefined }

    setTurns((prev) => [...prev, {
      ...createTempTurn({
        tempId,
        prompt:           question,
        videoEnabled:     effectiveVideoEnabled,
        parentSessionId:  sessionId ?? null,
        parentFrameIndex: null,
      }),
      stages: [], sources: [], synthesisText: '', synthesisComplete: false,
    }])

    const renderModeId   = selectedRenderMode?.id !== 'auto' ? selectedRenderMode?.id : null
    const donePayload    = { current: null }
    const handleSSEEvent = createTurnSSEHandler(tempId, { setTurns, toast, donePayloadRef: donePayload })

    try {
      await api.generateStream(
        {
          message:         question,
          conversationId:  activeConvId,
          pauseContext:    pauseCtx,
          notesEnabled,
          provider:        effectiveModel.provider,
          model:           effectiveModel.model,
          renderMode:      renderModeId,
          parentSessionId: sessionId ?? null,
          videoEnabled:    effectiveVideoEnabled,
          researchMode:    'instant',
        },
        (event) => {
          if (isStale()) return
          handleSSEEvent(event)
        },
        genController.signal,
      )

      if (genController.signal.aborted) {
        setTurns(prev => prev.filter(t => t.tempId !== tempId))
        return
      }

      const done = donePayload.current
      if (!done) return

      setTurns(prev => prev.map(t => t.tempId === tempId ? {
        ...t,
        isLoading:       false,
        id:              done.session_id,
        conversation_id: done.conversation_id,
        turn_index:      done.turn_index,
        intent_type:     done.intent_type,
        render_path:     done.render_path,
        frame_count:     done.frame_count ?? t.frame_count,
        ...(effectiveVideoEnabled ? {
          framesData:  normalizeFramesData(done),
          videoPhase:  'generating',
        } : {}),
      } : t))

      await onConversationsRefresh()
      if (effectiveVideoEnabled) runVideoGenerationForTurn(tempId, done.session_id)

    } catch (err) {
      if (genController.signal.aborted) {
        setTurns(prev => prev.filter(t => t.tempId !== tempId))
        return
      }
      console.error('[Studio] handleLearnGenerate:', err)
      toast.error('Generation failed. Please try again.')
      setTurns(prev => prev.map(t =>
        t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
      ))
    }
  }, [
    activeConvId, notesEnabled, videoEnabled, selectedModel, selectedRenderMode,
    onConversationsRefresh, runVideoGenerationForTurn, toast, setTurns,
  ])

  // ── handleRetryGeneration ─────────────────────────────────────────────────

  const handleRetryGeneration = useCallback(async (turn) => {
    setTurns((prev) => prev.map((t) =>
      t.tempId === turn.tempId ? {
        ...t, isLoading: true, stage: 'planning', stages: [],
        videoPhase: null, id: null, synthesisText: '', synthesisComplete: false, sources: [],
      } : t
    ))

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const pauseCtx = turn.parentSessionId
      ? { sessionId: turn.parentSessionId, frameIndex: turn.parentFrameIndex ?? undefined, caption: undefined }
      : null

    const renderModeId   = selectedRenderMode?.id !== 'auto' ? selectedRenderMode?.id : null
    const donePayload    = { current: null }
    const handleSSEEvent = createTurnSSEHandler(turn.tempId, { setTurns, toast, donePayloadRef: donePayload })

    try {
      await api.generateStream(
        {
          message:         turn.prompt,
          conversationId:  activeConvId,
          pauseContext:    pauseCtx,
          notesEnabled,
          provider:        selectedModel.provider,
          model:           selectedModel.model,
          renderMode:      renderModeId,
          parentSessionId: turn.parentSessionId ?? null,
          videoEnabled,
          researchMode:    'instant',
        },
        (event) => {
          if (isStale()) return
          handleSSEEvent(event)
        },
        genController.signal,
      )

      if (genController.signal.aborted) {
        setTurns(prev => prev.map(t => t.tempId === turn.tempId
          ? { ...t, isLoading: false, videoPhase: 'error' }
          : t
        ))
        return
      }

      const done = donePayload.current
      if (!done) return

      setTurns(prev => prev.map(t => t.tempId === turn.tempId ? {
        ...t,
        isLoading:       false,
        id:              done.session_id,
        conversation_id: done.conversation_id,
        turn_index:      done.turn_index,
        intent_type:     done.intent_type,
        render_path:     done.render_path,
        frame_count:     done.frame_count ?? t.frame_count,
        ...(videoEnabled ? {
          framesData: normalizeFramesData(done),
          videoPhase: 'generating',
        } : {}),
      } : t))

      await onConversationsRefresh()
      if (videoEnabled) runVideoGenerationForTurn(turn.tempId, done.session_id)

    } catch (err) {
      if (genController.signal.aborted) {
        setTurns(prev => prev.map(t => t.tempId === turn.tempId
          ? { ...t, isLoading: false, videoPhase: 'error' }
          : t
        ))
        return
      }
      console.error('[Studio] handleRetryGeneration:', err)
      toast.error('Generation failed. Please try again.')
      setTurns(prev => prev.map(t =>
        t.tempId === turn.tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
      ))
    }
  }, [
    activeConvId, notesEnabled, videoEnabled, selectedModel, selectedRenderMode,
    onConversationsRefresh, runVideoGenerationForTurn, toast, setTurns,
  ])

  return {
    handleGenerate,
    handleLearnGenerate,
    handleRetryGeneration,
    generationAbortRef,
  }
}
