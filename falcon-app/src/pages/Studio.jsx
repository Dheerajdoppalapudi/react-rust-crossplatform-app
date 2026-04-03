import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Tooltip, IconButton, Typography, Divider, useTheme } from '@mui/material'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'

import LoadingView         from '../components/Studio/LoadingView'
import EmptyView           from '../components/Studio/EmptyView'
import ConversationThread  from '../components/Studio/ConversationThread'
import PromptBar           from '../components/Studio/PromptBar'
import LearningView        from '../components/Studio/LearningView/index'

import { api } from '../services/api'
import { DEFAULT_MODEL, FOLLOWUP_SUGGESTIONS } from '../components/Studio/constants'

// ─── Studio ────────────────────────────────────────────────────────────────────
export default function Studio({ activeConvId, onActiveConvIdChange, onConversationsRefresh }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // ── Notes toggle — persisted across sessions ──────────────────────────────────
  const [notesEnabled, setNotesEnabled] = useState(
    () => localStorage.getItem('studio-notes-enabled') === 'true'
  )
  const toggleNotes = () => setNotesEnabled((prev) => {
    const next = !prev
    localStorage.setItem('studio-notes-enabled', String(next))
    return next
  })

  // ── Prompt input ─────────────────────────────────────────────────────────────
  const [prompt, setPrompt]               = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const inputRef                                = useRef(null)
  const threadBottomRef       = useRef(null)
  const contentScrollRef      = useRef(null)

  // ── Active conversation turns ─────────────────────────────────────────────────
  const [turns, setTurns] = useState([])

  // True while the FIRST turn of a brand-new conversation is being submitted
  const [isBootstrapping, setIsBootstrapping]   = useState(false)
  const [bootstrapStage, setBootstrapStage]     = useState('planning')
  const [bootstrapPrompt, setBootstrapPrompt]   = useState('')
  const [bootstrapFrames, setBootstrapFrames]   = useState(null)

  // ── View mode ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('chat')  // 'chat' | 'learn'

  // ── Pause context ─────────────────────────────────────────────────────────────
  const [pauseContext, setPauseContext] = useState(null)

  // ── Track which convId we've already loaded to avoid duplicate loads ──────────
  const loadedConvIdRef = useRef(null)

  // ── Helpers ───────────────────────────────────────────────────────────────────

  // Update the videoPhase on a specific turn (matched by tempId or real id)
  const setTurnVideoPhase = useCallback((tempId, sessionId, phase) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.tempId === tempId || (sessionId && t.id === sessionId) ? { ...t, videoPhase: phase } : t
      )
    )
  }, [])

  // Run video generation for a turn; streams SSE progress and updates videoPhase
  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId, onDone) => {
    try {
      await api.generateVideoStream(sessionId, (event) => {
        if (event.type === 'done') {
          setTurnVideoPhase(tempId, sessionId, event.video_path ? 'ready' : 'error')
        } else if (event.type === 'error') {
          setTurnVideoPhase(tempId, sessionId, 'error')
        }
      })
    } catch {
      setTurnVideoPhase(tempId, sessionId, 'error')
    } finally {
      onDone?.()
    }
  }, [setTurnVideoPhase])

  // Scroll the thread to the bottom whenever turns change
  useEffect(() => {
    if (threadBottomRef.current) {
      threadBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [turns.length])

  // ── Load conversation by id ───────────────────────────────────────────────────
  const loadConversationById = useCallback(async (convId) => {
    setTurns([])
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0

    const data = await api.getConversation(convId)
    if (!data) return

    const loadedTurns = data.turns.map((t) => ({
      tempId:           t.id,
      id:               t.id,
      prompt:           t.prompt,
      intent_type:      t.intent_type,
      render_path:      t.render_path,
      frame_count:      t.frame_count,
      isLoading:        false,
      framesData:       null,
      videoPhase:       t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating'),
      parentSessionId:  t.parent_session_id  ?? null,
      parentFrameIndex: t.parent_frame_index ?? null,
    }))

    setTurns(loadedTurns)

    // Load frames meta + trigger missing video generation for each turn
    loadedTurns.forEach(async (turn) => {
      try {
        const raw = await api.getFramesMeta(turn.id)
        if (raw) {
          const framesData = {
            render_path:         raw.render_path,
            images:              raw.images              || [],
            captions:            raw.captions            || [],
            suggested_followups: raw.suggested_followups || [],
            notes:               raw.notes               || '',
          }
          setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, framesData } : t))
        }
      } catch { /* non-critical */ }

      if (turn.videoPhase === 'generating') {
        runVideoGenerationForTurn(turn.tempId, turn.id)
      }
    })
  }, [runVideoGenerationForTurn])

  // Keep a ref so useEffect doesn't need loadConversationById in its dep array
  const loadConversationByIdRef = useRef(loadConversationById)
  loadConversationByIdRef.current = loadConversationById

  // ── React to activeConvId prop changes (driven by Sidebar selection) ──────────
  useEffect(() => {
    if (activeConvId && activeConvId !== loadedConvIdRef.current) {
      loadedConvIdRef.current = activeConvId
      loadConversationByIdRef.current(activeConvId)
    } else if (!activeConvId && loadedConvIdRef.current !== null) {
      // Sidebar "New Chat" was clicked — clear all local state
      loadedConvIdRef.current = null
      setTurns([])
      setPrompt('')
      setIsBootstrapping(false)
      if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
    }
  }, [activeConvId])

  // ── Submit handler ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isBootstrapping || turns.some((t) => t.isLoading)) return

    const submittedPrompt = prompt.trim()
    setPrompt('')

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    if (isFirstTurn) {
      setIsBootstrapping(true)
      setBootstrapStage('planning')
      setBootstrapPrompt(submittedPrompt)
      setTurns([])
      if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
    } else {
      setTurns((prev) => [...prev, {
        tempId,
        id:               null,
        prompt:           submittedPrompt,
        intent_type:      null,
        render_path:      null,
        frame_count:      null,
        isLoading:        true,
        stage:            'planning',
        framesData:       null,
        videoPhase:       'generating',
        parentSessionId:  pauseContext?.sessionId  ?? null,
        parentFrameIndex: pauseContext?.frameIndex ?? null,
      }])
    }

    const t1  = isFirstTurn  ? setTimeout(() => setBootstrapStage('generating'), 2500) : null
    const t2  = isFirstTurn  ? setTimeout(() => setBootstrapStage('rendering'),  6000) : null
    const it1 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'generating' } : t)), 2500) : null
    const it2 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'rendering' }  : t)), 6000) : null

    const capturedPauseContext = pauseContext
    setPauseContext(null)

    try {
      const data = await api.imageGeneration(submittedPrompt, activeConvId, capturedPauseContext, notesEnabled, selectedModel.provider, selectedModel.model)

      const framesData = {
        render_path:         data.render_path,
        images:              data.images              || [],
        captions:            data.captions            || [],
        suggested_followups: data.suggested_followups || [],
        notes:               data.notes               || '',
      }
      const realTurn = {
        tempId,
        id:                  data.session_id,
        conversation_id:     data.conversation_id,
        turn_index:          data.turn_index,
        prompt:              submittedPrompt,
        intent_type:         data.intent_type,
        render_path:         data.render_path,
        frame_count:         data.frame_count,
        isLoading:           false,
        stage:               null,
        framesData,
        videoPhase:          'generating',
        parentSessionId:     capturedPauseContext?.sessionId  ?? null,
        parentFrameIndex:    capturedPauseContext?.frameIndex ?? null,
      }

      if (isFirstTurn) {
        // Mark as loaded before notifying parent to prevent useEffect re-load
        loadedConvIdRef.current = data.conversation_id
        onActiveConvIdChange(data.conversation_id)
        setBootstrapStage('frames')
        setBootstrapFrames({ framesData, sessionId: data.session_id })
        setTurns([realTurn])
        await onConversationsRefresh()
        setBootstrapStage('video')
        runVideoGenerationForTurn(tempId, data.session_id, () => {
          setIsBootstrapping(false)
          setBootstrapFrames(null)
        })
      } else {
        setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
        await onConversationsRefresh()
        runVideoGenerationForTurn(tempId, data.session_id)
      }
    } catch (err) {
      console.error('[Studio] handleGenerate:', err)
      if (isFirstTurn) {
        setIsBootstrapping(false)
        setTurns([])
        onActiveConvIdChange(null)
      } else {
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      if (t1)  clearTimeout(t1)
      if (t2)  clearTimeout(t2)
      if (it1) clearTimeout(it1)
      if (it2) clearTimeout(it2)
    }
  }, [prompt, isBootstrapping, turns, activeConvId, notesEnabled, pauseContext, onActiveConvIdChange, onConversationsRefresh, runVideoGenerationForTurn])


  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }

  const handleNewConversation = () => {
    loadedConvIdRef.current = null
    onActiveConvIdChange(null)
    setTurns([])
    setPrompt('')
    setIsBootstrapping(false)
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
    inputRef.current?.focus()
  }

  const handlePauseAsk = useCallback(({ sessionId, currentTime, duration, frameIndex: directFrameIndex, caption: directCaption }) => {
    const turn = turns.find((t) => t.id === sessionId)
    if (!turn) return
    const frameCount = turn.frame_count || 1
    const frameIndex = directFrameIndex != null
      ? directFrameIndex
      : Math.min(Math.floor((currentTime / duration) * frameCount), frameCount - 1)
    const caption = directCaption ?? turn.framesData?.captions?.[frameIndex] ?? null
    setPauseContext({ sessionId, frameIndex, caption })
    inputRef.current?.focus()
  }, [turns, inputRef])

  const lastTurn = turns.filter((t) => t.intent_type).at(-1) ?? null
  const activeConversationMeta = activeConvId ? {
    id:                  activeConvId,
    intent_type:         lastTurn?.intent_type  ?? null,
    suggested_followups: lastTurn?.framesData?.suggested_followups ?? [],
  } : null

  const isAnyGenerating = isBootstrapping || turns.some((t) => t.isLoading)
  const showEmpty  = !isBootstrapping && turns.length === 0
  const showLoader = isBootstrapping
  const showThread = !isBootstrapping && turns.length > 0

  const handleLearnAsk = useCallback(({ question, sessionId, frameIndex, caption }) => {
    setPauseContext({ sessionId, frameIndex: frameIndex ?? undefined, caption: caption ?? undefined })
    setPrompt(question)
    setViewMode('chat')
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  // ── Learning canvas — full-screen focus mode ──────────────────────────────────
  if (viewMode === 'learn') {
    return (
      <LearningView
        turns={turns}
        conversationId={activeConvId}
        onExit={() => setViewMode('chat')}
        onAskFromLearn={handleLearnAsk}
      />
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      bgcolor: 'background.default',
      position: 'relative',
    }}>

      {/* ── Floating controls pill — top right ───────────────────────────────── */}
      <Box sx={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 0.75,
        bgcolor: isDark ? 'rgba(26,26,26,0.85)' : 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '10px',
        px: 0.75, py: 0.5,
        boxShadow: isDark
          ? '0 4px 16px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}>
        {/* Chat / Learn toggle */}
        <Box sx={{
          display: 'flex',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          borderRadius: '7px',
          p: 0.25, gap: 0.2,
        }}>
          {['Chat', 'Learn'].map((label) => {
            const m      = label.toLowerCase()
            const active = viewMode === m
            return (
              <Box
                key={m}
                onClick={() => setViewMode(m)}
                sx={{
                  px: 1.25, py: 0.35,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  userSelect: 'none',
                  bgcolor: active ? theme.palette.primary.main : 'transparent',
                  color: active ? '#fff' : theme.palette.text.secondary,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Box>
            )
          })}
        </Box>

        {/* Notes toggle */}
        <Tooltip title={notesEnabled ? 'Notes on' : 'Notes off'}>
          <IconButton
            size="small"
            onClick={toggleNotes}
            sx={{
              borderRadius: '7px', p: 0.6,
              border: `1px solid ${notesEnabled
                ? (isDark ? 'rgba(79,110,255,0.45)' : '#c7d2fe')
                : (isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0')}`,
              color: notesEnabled
                ? theme.palette.primary.main
                : (isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'),
              bgcolor: notesEnabled
                ? (isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff')
                : 'transparent',
              '&:hover': {
                borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
                color: notesEnabled ? theme.palette.primary.main : (isDark ? '#fff' : '#374151'),
              },
              transition: 'all 0.15s',
            }}
          >
            <NotesOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Scrollable middle */}
        <Box
          ref={contentScrollRef}
          sx={{
            flex: 1, overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}
        >
          {showLoader && (
            <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3 }}>
              {bootstrapPrompt && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 1.5 }}>
                  <Box sx={{
                    maxWidth: '72%', px: 2.5, py: 1.5,
                    backgroundColor: isDark ? '#242424' : '#f1f5f9',
                    color: theme.palette.text.primary,
                    borderRadius: '18px 18px 4px 18px',
                    fontSize: 14.5, lineHeight: 1.6,
                    border: `1px solid ${isDark ? '#2e2e2e' : '#e2e8f0'}`,
                  }}>
                    {bootstrapPrompt}
                  </Box>
                </Box>
              )}
              <LoadingView stage={bootstrapStage} framesData={bootstrapFrames} />
            </Box>
          )}

          {showEmpty && (
            <EmptyView onSuggestionClick={(s) => { setPrompt(s); inputRef.current?.focus() }} />
          )}

          {showThread && (() => {
            const isFollowUp = !!activeConvId && !isAnyGenerating
            const suggestions = isFollowUp && !pauseContext
              ? (activeConversationMeta?.suggested_followups?.length
                  ? activeConversationMeta.suggested_followups
                  : (FOLLOWUP_SUGGESTIONS[activeConversationMeta?.intent_type] || FOLLOWUP_SUGGESTIONS.illustration))
              : []

            return (
              <>
                <ConversationThread turns={turns} onPauseAsk={handlePauseAsk} />

                {suggestions.length > 0 && (
                  <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3, pt: 2, pb: 3 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.secondary, mb: 0.5 }}>
                      Follow-ups
                    </Typography>
                    {suggestions.map((s, i) => (
                      <Box key={s}>
                        {i > 0 && <Divider sx={{ opacity: 0.2 }} />}
                        <Box
                          onClick={() => { setPrompt(s); inputRef.current?.focus() }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            py: 0.9, px: 0.5, cursor: 'pointer', userSelect: 'none',
                            color: theme.palette.text.secondary,
                            '&:hover': { color: theme.palette.text.primary },
                            transition: 'color 0.15s',
                          }}
                        >
                          <Typography sx={{ fontSize: 14.5, opacity: 0.35, flexShrink: 0, lineHeight: 1 }}>↳</Typography>
                          <Typography sx={{ fontSize: 14.5, fontWeight: 400, lineHeight: 1.6 }}>{s}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box ref={threadBottomRef} sx={{ height: 1 }} />
              </>
            )
          })()}
        </Box>

        {/* Prompt bar */}
        <PromptBar
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={handleGenerate}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          isGenerating={isAnyGenerating}
          activeConversation={activeConversationMeta}
          onNewConversation={handleNewConversation}
          pauseContext={pauseContext}
          onClearPauseContext={() => setPauseContext(null)}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </Box>

    </Box>
  )
}
