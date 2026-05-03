import { useRef, useCallback } from 'react'
import { api } from '../services/api'
import { createTempTurn, normalizeFramesData } from '../components/Studio/studioUtils'

// ── Shared generation utilities (C1) ─────────────────────────────────────────
//
// These helpers were previously copy-pasted in handleGenerate,
// handleLearnGenerate, and handleRetryGeneration.  Extracting them here means
// the stage-delay constants, timer wiring, and turn-shape definition each live
// in exactly one place.

/**
 * Optimistic stage label delays (ms).  Both timers fire only when video mode
 * is active — interactive/text mode drives labels via SSE meta events instead.
 *
 * Values mirror the approximate server-side pipeline stage durations so the UI
 * appears to progress meaningfully before the API response arrives.
 */
const STAGE_DELAYS = Object.freeze({ generating: 2_500, rendering: 6_000 })

/**
 * Arms setTimeout-based optimistic stage label updates for a non-first turn.
 * Updates turn.stage in the array so the LoadingView spinner shows progress.
 *
 * Returns { clear } — ALWAYS call clear() in a finally block to cancel timers
 * if the generation resolves (success or abort) before the delays fire.
 *
 * @param {string}   tempId     - Temporary id of the turn being generated.
 * @param {boolean}  start      - When false, returns a no-op cleanup immediately.
 * @param {Function} setTurns   - React state dispatcher for the turns array.
 */
function startTurnStageTimers(tempId, start, setTurns) {
  if (!start) return { clear: () => {} }

  const t1 = setTimeout(
    () => setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'generating' } : t)),
    STAGE_DELAYS.generating,
  )
  const t2 = setTimeout(
    () => setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'rendering'  } : t)),
    STAGE_DELAYS.rendering,
  )

  return { clear: () => { clearTimeout(t1); clearTimeout(t2) } }
}

/**
 * Builds the permanent turn object from a completed imageGeneration response.
 * Single source of truth for the post-generation turn shape — avoids the three
 * separate inline object literals that previously had to be kept in sync.
 *
 * @param {object} params
 * @param {string} params.tempId
 * @param {string} params.prompt
 * @param {object} params.data            - Raw API response from imageGeneration.
 * @param {boolean} params.videoEnabled
 * @param {string|null} params.parentSessionId
 * @param {number|null} params.parentFrameIndex
 * @returns {object} Turn object ready to splice into the turns array.
 */
function buildRealTurn({ tempId, prompt, data, videoEnabled, parentSessionId, parentFrameIndex }) {
  return {
    tempId,
    id:               data.session_id,
    conversation_id:  data.conversation_id,
    turn_index:       data.turn_index,
    prompt,
    intent_type:      data.intent_type,
    render_path:      data.render_path,
    frame_count:      data.frame_count,
    isLoading:        false,
    stage:            null,
    framesData:       normalizeFramesData(data),
    videoPhase:       videoEnabled ? 'generating' : 'disabled',
    parentSessionId:  parentSessionId  ?? null,
    parentFrameIndex: parentFrameIndex ?? null,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Owns all three generation entry points (handleGenerate, handleLearnGenerate,
 * handleRetryGeneration) and the AbortController for the active generation
 * request.  Returns generationAbortRef so Studio.jsx can cancel a running
 * generation when the user switches conversations.
 *
 * The hook is intentionally a "fat" controller — it holds no UI state itself
 * and delegates all rendering concerns back to Studio.jsx via setTurns,
 * setIsBootstrapping, etc.
 */
export function useGeneration({
  // Conversation context
  activeConvId,
  loadedConvIdRef,
  onActiveConvIdChange,
  onConversationsRefresh,
  // Derived from turns (memoized in Studio.jsx — avoids passing turns array)
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
  // Pause context
  pauseContext,
  setPauseContext,
  // Bootstrap overlay (single atomic setter from useConversation)
  setBootstrap,
  // Video stream
  runVideoGenerationForTurn,
  // UI helpers
  scrollToTop,
  toast,
}) {
  // Monotonic counter — incremented on every new generation.  Each generation
  // captures the counter value at creation time and checks isStale() before
  // applying any async result.  This prevents a slow in-flight response from
  // stomping a newer generation that started after it.
  const generationIdRef  = useRef(0)

  // Shared AbortController for the active generation fetch.  Replaced on each
  // new call; the old controller is aborted first so concurrent calls are safe.
  // Exposed to Studio.jsx so the conversation-switch effect can cancel it.
  const generationAbortRef = useRef(null)

  // ── handleGenerate ────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isAnyGenerating) return

    const submittedPrompt = prompt.trim()
    setPrompt('')

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    const parentSessionId = isFirstTurn
      ? null
      : (pauseContext?.sessionId ?? lastCompletedTurnId)

    // ── Optimistic UI setup ───────────────────────────────────────────────────

    if (isFirstTurn) {
      setBootstrap({ stage: 'planning', prompt: submittedPrompt, frames: null })
      setTurns([])
      scrollToTop()
    } else {
      setTurns((prev) => [...prev, createTempTurn({
        tempId,
        prompt:           submittedPrompt,
        videoEnabled,
        parentSessionId,
        parentFrameIndex: pauseContext?.frameIndex ?? null,
      })])
    }

    // Bootstrap overlay stage timers — only for first-turn + video mode.
    const bt1 = (isFirstTurn && videoEnabled)
      ? setTimeout(() => setBootstrap((b) => b ? { ...b, stage: 'generating' } : b), STAGE_DELAYS.generating) : null
    const bt2 = (isFirstTurn && videoEnabled)
      ? setTimeout(() => setBootstrap((b) => b ? { ...b, stage: 'rendering'  } : b), STAGE_DELAYS.rendering)  : null

    // Per-turn stage label timers for follow-up turns (video and interactive).
    const { clear: clearTurnTimers } = !isFirstTurn
      ? startTurnStageTimers(tempId, true, setTurns)
      : { clear: () => {} }

    const capturedPauseContext = pauseContext
    setPauseContext(null)

    try {
      // ── Interactive / text mode ─────────────────────────────────────────────
      if (!videoEnabled) {
        const updateTurn = (updates) =>
          setTurns((prev) => prev.map((t) => t.tempId === tempId ? { ...t, ...updates } : t))

        if (!isFirstTurn) {
          updateTurn({ render_path: 'interactive', title: '', followUps: [], blocks: [] })
        }

        // Wrap in an object so the SSE callback and the post-await read share
        // the same mutable slot without depending on JS closure mutation across
        // async boundaries (I5 — stale closure fix).
        const resolvedConvId = { current: activeConvId }

        await api.interactiveGeneration(
          {
            message:         submittedPrompt,
            conversationId:  activeConvId,
            parentSessionId,
            provider:        selectedModel.provider,
            model:           selectedModel.model,
          },
          (event) => {
            if (isStale()) return

            if (event.type === 'meta') {
              const baseTurnData = {
                render_path: 'interactive', isLoading: true,
                title: event.title ?? '', followUps: event.follow_ups ?? [], learningObjective: event.learning_objective ?? null, blocks: [],
              }
              if (isFirstTurn) {
                setTurns([{
                  tempId, id: null, prompt: submittedPrompt,
                  stage: null, framesData: null, videoPhase: 'disabled',
                  parentSessionId, parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
                  ...baseTurnData,
                }])
                setBootstrap(null)
              } else {
                updateTurn(baseTurnData)
              }
            }

            if (event.type === 'block') {
              setTurns((prev) => prev.map((t) => t.tempId === tempId
                ? { ...t, blocks: [...(t.blocks ?? []), event.block] }
                : t
              ))
            }

            if (event.type === 'done') {
              resolvedConvId.current = event.conversation_id || resolvedConvId.current
              setTurns((prev) => prev.map((t) => t.tempId === tempId
                ? { ...t, isLoading: false, id: event.session_id, conversation_id: event.conversation_id }
                : t
              ))
            }

            if (event.type === 'error') {
              toast.error(event.message || 'Generation failed. Please try again.')
              if (isFirstTurn) {
                setBootstrap(null)
                setTurns([])
                onActiveConvIdChange(null)
              } else {
                updateTurn({ isLoading: false, videoPhase: 'error' })
              }
            }
          },
          genController.signal,
        )

        if (isFirstTurn && resolvedConvId.current) {
          loadedConvIdRef.current = resolvedConvId.current
          onActiveConvIdChange(resolvedConvId.current)
        }
        await onConversationsRefresh()
        return
      }

      // ── Video mode ─────────────────────────────────────────────────────────
      const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode.id : null

      const data = await api.imageGeneration({
        message:        submittedPrompt,
        conversationId: activeConvId,
        pauseContext:   capturedPauseContext,
        notesEnabled,
        provider:       selectedModel.provider,
        model:          selectedModel.model,
        signal:         genController.signal,
        renderMode:     renderModeId,
        parentSessionId,
        textOnly:       false,
      })

      if (isStale()) return

      const realTurn = buildRealTurn({
        tempId,
        prompt:           submittedPrompt,
        data,
        videoEnabled,
        parentSessionId,
        parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
      })

      if (isFirstTurn) {
        loadedConvIdRef.current = data.conversation_id
        onActiveConvIdChange(data.conversation_id)
        setBootstrap((b) => b ? { ...b, stage: 'frames', frames: { framesData: realTurn.framesData, sessionId: data.session_id } } : b)
        setTurns([realTurn])
        await onConversationsRefresh()
        setBootstrap((b) => b ? { ...b, stage: 'video' } : b)
        runVideoGenerationForTurn(tempId, data.session_id, () => setBootstrap(null))
      } else {
        setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
        await onConversationsRefresh()
        runVideoGenerationForTurn(tempId, data.session_id)
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      console.error('[Studio] handleGenerate:', err)
      toast.error('Generation failed. Please try again.')
      if (isFirstTurn) {
        setBootstrap(null)
        setTurns([])
        onActiveConvIdChange(null)
      } else {
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      clearTimeout(bt1)
      clearTimeout(bt2)
      clearTurnTimers()
    }
  }, [
    prompt, isAnyGenerating, lastCompletedTurnId, activeConvId, notesEnabled, videoEnabled,
    pauseContext, selectedModel, selectedRenderMode, onActiveConvIdChange,
    onConversationsRefresh, runVideoGenerationForTurn, scrollToTop, toast,
    loadedConvIdRef, setBootstrap, setPauseContext, setPrompt,
  ])

  // ── handleLearnGenerate ───────────────────────────────────────────────────

  /**
   * Generates a new turn from the learning canvas (AskNode ghost node).
   * Accepts per-ask model and videoEnabled overrides so the user can pick
   * different settings per canvas branch without touching the global toolbar.
   */
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

    const tempId           = `temp_${Date.now()}`
    const capturedPauseCtx = { sessionId, frameIndex: undefined, caption: undefined }

    setTurns((prev) => [...prev, createTempTurn({
      tempId,
      prompt:           question,
      videoEnabled:     effectiveVideoEnabled,
      parentSessionId:  sessionId ?? null,
      parentFrameIndex: null,
    })])

    const { clear: clearTurnTimers } = startTurnStageTimers(tempId, effectiveVideoEnabled, setTurns)

    try {
      const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode.id : null

      const data = await api.imageGeneration({
        message:        question,
        conversationId: activeConvId,
        pauseContext:   capturedPauseCtx,
        notesEnabled,
        provider:       effectiveModel.provider,
        model:          effectiveModel.model,
        signal:         genController.signal,
        renderMode:     renderModeId,
        textOnly:       !effectiveVideoEnabled,
      })

      if (isStale()) return

      const realTurn = buildRealTurn({
        tempId,
        prompt:           question,
        data,
        videoEnabled:     effectiveVideoEnabled,
        parentSessionId:  capturedPauseCtx.sessionId ?? null,
        parentFrameIndex: null,
      })

      setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
      await onConversationsRefresh()
      if (effectiveVideoEnabled) runVideoGenerationForTurn(tempId, data.session_id)
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[Studio] handleLearnGenerate:', err)
        toast.error('Generation failed. Please try again.')
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      clearTurnTimers()
    }
  }, [
    activeConvId, notesEnabled, videoEnabled, selectedModel, selectedRenderMode,
    onConversationsRefresh, runVideoGenerationForTurn, toast,
  ])

  // ── handleRetryGeneration ─────────────────────────────────────────────────

  /**
   * Retries a generation that failed before a session id was created (i.e.
   * the API call itself failed, not just video assembly).  Resets the turn to
   * loading state in-place and re-runs imageGeneration with current preferences.
   */
  const handleRetryGeneration = useCallback(async (turn) => {
    setTurns((prev) => prev.map((t) =>
      t.tempId === turn.tempId
        ? { ...t, isLoading: true, stage: 'planning', videoPhase: null, id: null }
        : t
    ))

    const pauseCtx = turn.parentSessionId
      ? {
          sessionId:  turn.parentSessionId,
          frameIndex: turn.parentFrameIndex ?? undefined,
          caption:    undefined,
        }
      : null

    const { clear: clearTurnTimers } = startTurnStageTimers(turn.tempId, videoEnabled, setTurns)

    try {
      const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode.id : null

      const data = await api.imageGeneration({
        message:        turn.prompt,
        conversationId: activeConvId,
        pauseContext:   pauseCtx,
        notesEnabled,
        provider:       selectedModel.provider,
        model:          selectedModel.model,
        renderMode:     renderModeId,
        textOnly:       !videoEnabled,
        // No signal — retries are user-initiated and shouldn't be cancelled by nav.
      })

      const realTurn = buildRealTurn({
        tempId:           turn.tempId,
        prompt:           turn.prompt,
        data,
        videoEnabled,
        parentSessionId:  turn.parentSessionId  ?? null,
        parentFrameIndex: turn.parentFrameIndex ?? null,
      })

      setTurns((prev) => prev.map((t) => t.tempId === turn.tempId ? realTurn : t))
      await onConversationsRefresh()
      if (videoEnabled) runVideoGenerationForTurn(turn.tempId, data.session_id)
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error('Generation failed. Please try again.')
        setTurns((prev) => prev.map((t) =>
          t.tempId === turn.tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      clearTurnTimers()
    }
  }, [
    activeConvId, notesEnabled, videoEnabled, selectedModel, selectedRenderMode,
    onConversationsRefresh, runVideoGenerationForTurn, toast,
  ])

  return {
    handleGenerate,
    handleLearnGenerate,
    handleRetryGeneration,
    generationAbortRef,
  }
}
