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
  // Staging buffer for the first turn — accumulates stages/sources/tokens
  // before the turn row exists in state (turns starts as []).
  const firstTurnStagingRef = useRef({ stages: [], sources: [], synthesisText: '' })

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

    // Reset first-turn staging buffer for this generation run
    firstTurnStagingRef.current = { stages: [], sources: [], synthesisText: '' }

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
        stages: [{ id: 'planning', label: 'Planning…', status: 'active' }],
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

          switch (event.type) {
            case 'stage': {
              if (isFirstTurn) {
                firstTurnStagingRef.current.stages = _applyStage(firstTurnStagingRef.current.stages, event)
                setBootstrap(b => b ? { ...b, stage: event.stage, stages: firstTurnStagingRef.current.stages } : b)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, stages: _applyStage(t.stages ?? [], event) }
                  : t
                ))
              }
              break
            }
            case 'stage_done': {
              if (isFirstTurn) {
                firstTurnStagingRef.current.stages = _applyStageDone(firstTurnStagingRef.current.stages, event)
                setBootstrap(b => b ? { ...b, stages: firstTurnStagingRef.current.stages } : b)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, stages: _applyStageDone(t.stages ?? [], event) }
                  : t
                ))
              }
              break
            }
            case 'source': {
              if (isFirstTurn) {
                firstTurnStagingRef.current.sources = [...firstTurnStagingRef.current.sources, event.source]
                setBootstrap(b => b ? { ...b, sources: firstTurnStagingRef.current.sources } : b)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, sources: [...(t.sources ?? []), event.source] }
                  : t
                ))
              }
              break
            }
            case 'token': {
              if (isFirstTurn) {
                firstTurnStagingRef.current.synthesisText += event.text
                setBootstrap(b => b ? { ...b, synthesisText: firstTurnStagingRef.current.synthesisText } : b)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, synthesisText: (t.synthesisText ?? '') + event.text }
                  : t
                ))
              }
              break
            }
            case 'synthesis_done': {
              if (isFirstTurn) {
                if (event.sources) firstTurnStagingRef.current.sources = event.sources
                setBootstrap(b => b ? { ...b, sources: firstTurnStagingRef.current.sources } : b)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId
                  ? { ...t, synthesisComplete: true, sources: event.sources ?? t.sources ?? [] }
                  : t
                ))
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
                setTurns([{
                  tempId, id: null, prompt: submittedPrompt,
                  stage: null, framesData: null, videoPhase: 'disabled',
                  parentSessionId,
                  parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
                  // Carry forward all stages/sources/tokens buffered before meta arrived
                  stages:        firstTurnStagingRef.current.stages,
                  sources:       firstTurnStagingRef.current.sources,
                  synthesisText: firstTurnStagingRef.current.synthesisText,
                  synthesisComplete: false,
                  ...turnData,
                }])
                setBootstrap(null)
              } else {
                setTurns(prev => prev.map(t => t.tempId === tempId ? { ...t, ...turnData } : t))
              }
              break
            }
            case 'block': {
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, blocks: [...(t.blocks ?? []), event.block] }
                : t
              ))
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
            conversation_id:  done.conversation_id,
            turn_index:       done.turn_index,
            prompt:           submittedPrompt,
            intent_type:      done.intent_type,
            render_path:      done.render_path,
            frame_count:      done.frame_count,
            isLoading:        false,
            stage:            null,
            framesData,
            videoPhase:       'generating',
            parentSessionId,
            parentFrameIndex: capturedPauseContext?.frameIndex ?? null,
            stages:        firstTurnStagingRef.current.stages,
            sources:       firstTurnStagingRef.current.sources,
            synthesisText: firstTurnStagingRef.current.synthesisText,
            synthesisComplete: false,
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

    const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode?.id : null
    const donePayload  = { current: null }

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
          switch (event.type) {
            case 'stage':
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, stages: _applyStage(t.stages ?? [], event) }
                : t
              ))
              break
            case 'stage_done':
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, stages: _applyStageDone(t.stages ?? [], event) }
                : t
              ))
              break
            case 'meta':
              setTurns(prev => prev.map(t => t.tempId === tempId ? {
                ...t, render_path: 'interactive', isLoading: true,
                title: event.title ?? '', followUps: event.follow_ups ?? [],
                learningObjective: event.learning_objective ?? null, blocks: [],
              } : t))
              break
            case 'block':
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, blocks: [...(t.blocks ?? []), event.block] }
                : t
              ))
              break
            case 'done':
              donePayload.current = event
              break
            case 'error':
              toast.error(event.message || 'Generation failed. Please try again.')
              setTurns(prev => prev.map(t => t.tempId === tempId
                ? { ...t, isLoading: false, videoPhase: 'error' }
                : t
              ))
              break
          }
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

    const pauseCtx = turn.parentSessionId
      ? { sessionId: turn.parentSessionId, frameIndex: turn.parentFrameIndex ?? undefined, caption: undefined }
      : null

    const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode?.id : null
    const donePayload  = { current: null }

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
          // No signal — retries are user-initiated and not cancelled by navigation.
        },
        (event) => {
          switch (event.type) {
            case 'stage':
              setTurns(prev => prev.map(t => t.tempId === turn.tempId ? _withStage(t, event) : t))
              break
            case 'stage_done':
              setTurns(prev => prev.map(t => t.tempId === turn.tempId ? _withStageDone(t, event) : t))
              break
            case 'meta':
              setTurns(prev => prev.map(t => t.tempId === turn.tempId ? {
                ...t, render_path: 'interactive', isLoading: true,
                title: event.title ?? '', followUps: event.follow_ups ?? [],
                learningObjective: event.learning_objective ?? null, blocks: [],
              } : t))
              break
            case 'block':
              setTurns(prev => prev.map(t => t.tempId === turn.tempId
                ? { ...t, blocks: [...(t.blocks ?? []), event.block] }
                : t
              ))
              break
            case 'done':
              donePayload.current = event
              break
            case 'error':
              toast.error(event.message || 'Generation failed. Please try again.')
              setTurns(prev => prev.map(t => t.tempId === turn.tempId
                ? { ...t, isLoading: false, videoPhase: 'error' }
                : t
              ))
              break
          }
        },
        // No AbortSignal — retries run to completion
      )

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
      if (err?.name !== 'AbortError') {
        toast.error('Generation failed. Please try again.')
        setTurns(prev => prev.map(t =>
          t.tempId === turn.tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
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
