import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'

import HistorySidebar      from '../components/Studio/HistorySidebar'
import LoadingView         from '../components/Studio/LoadingView'
import EmptyView           from '../components/Studio/EmptyView'
import ConversationThread  from '../components/Studio/ConversationThread'
import PromptBar           from '../components/Studio/PromptBar'
import LearningView        from '../components/Studio/LearningView/index'

import { api } from '../services/api'

// ─── Studio ────────────────────────────────────────────────────────────────────
export default function Studio() {
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
  const [prompt, setPrompt]   = useState('')
  const inputRef              = useRef(null)
  const threadBottomRef       = useRef(null)  // for auto-scroll when a new turn is added
  const contentScrollRef      = useRef(null)

  // ── Conversations list (sidebar) ──────────────────────────────────────────────
  const [conversations, setConversations] = useState([])

  // ── Active conversation ───────────────────────────────────────────────────────
  // activeConvId — which conversation is open
  // turns        — array of turn state objects for the active conversation
  const [activeConvId, setActiveConvId] = useState(null)
  const [turns, setTurns]               = useState([])

  // True while the FIRST turn of a brand-new conversation is being submitted
  // (used to show the full-screen LoadingView before any turns exist)
  const [isBootstrapping, setIsBootstrapping]   = useState(false)
  const [bootstrapStage, setBootstrapStage]     = useState('planning')
  const [bootstrapPrompt, setBootstrapPrompt]   = useState('')
  const [bootstrapFrames, setBootstrapFrames]   = useState(null)

  // ── View mode ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('chat')  // 'chat' | 'learn'

  // ── Pause context ─────────────────────────────────────────────────────────────
  const [pauseContext, setPauseContext] = useState(null)

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations()
      setConversations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[Studio] fetchConversations:', err)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Update the videoPhase on a specific turn (matched by tempId or real id)
  const setTurnVideoPhase = useCallback((tempId, sessionId, phase) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.tempId === tempId || (sessionId && t.id === sessionId) ? { ...t, videoPhase: phase } : t
      )
    )
  }, [])

  // Run video generation for a turn; updates videoPhase when done
  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId, onDone) => {
    try {
      const data = await api.generateVideo(sessionId)
      setTurnVideoPhase(tempId, sessionId, data.video_path ? 'ready' : 'error')
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

  // ── Load a conversation from history ──────────────────────────────────────────
  const loadConversation = useCallback(async (conv) => {
    setActiveConvId(conv.id)
    setTurns([])
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0

    const data = await api.getConversation(conv.id)
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

  // ── Submit handler ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isBootstrapping || turns.some((t) => t.isLoading)) return

    const submittedPrompt = prompt.trim()
    setPrompt('')

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    if (isFirstTurn) {
      // Show full-screen loader before we have any turns
      setIsBootstrapping(true)
      setBootstrapStage('planning')
      setBootstrapPrompt(submittedPrompt)
      setTurns([])
      if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
    } else {
      // Append a loading placeholder turn to the thread
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

    // Stage animation timers (only useful for the first turn bootstrap)
    const t1 = isFirstTurn ? setTimeout(() => setBootstrapStage('generating'), 2500) : null
    const t2 = isFirstTurn ? setTimeout(() => setBootstrapStage('rendering'),  6000) : null

    // Stage animation for in-thread loading turns
    const it1 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'generating' } : t)), 2500) : null
    const it2 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'rendering' }  : t)), 6000) : null

    // Capture and clear pause context before the async call
    const capturedPauseContext = pauseContext
    setPauseContext(null)

    try {
      const data = await api.imageGeneration(submittedPrompt, activeConvId, capturedPauseContext, notesEnabled)

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
        setActiveConvId(data.conversation_id)
        setBootstrapStage('frames')
        setBootstrapFrames({ framesData, sessionId: data.session_id })
        setTurns([realTurn])
        await fetchConversations()
        setBootstrapStage('video')
        runVideoGenerationForTurn(tempId, data.session_id, () => {
          setIsBootstrapping(false)
          setBootstrapFrames(null)
        })
      } else {
        setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
        await fetchConversations()
        runVideoGenerationForTurn(tempId, data.session_id)
      }
    } catch (err) {
      console.error('[Studio] handleGenerate:', err)
      if (isFirstTurn) {
        setIsBootstrapping(false)
        setTurns([])
        setActiveConvId(null)
      } else {
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      if (t1) clearTimeout(t1)
      if (t2) clearTimeout(t2)
      if (it1) clearTimeout(it1)
      if (it2) clearTimeout(it2)
    }
  }, [prompt, isBootstrapping, turns, activeConvId, notesEnabled, pauseContext, fetchConversations, runVideoGenerationForTurn])


  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }

  const handleNewConversation = () => {
    setActiveConvId(null)
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

  // Derive follow-up data from the last completed turn
  const lastTurn = turns.filter((t) => t.intent_type).at(-1) ?? null
  const activeConversationMeta = activeConvId ? {
    id:                  activeConvId,
    intent_type:         lastTurn?.intent_type  ?? null,
    suggested_followups: lastTurn?.framesData?.suggested_followups ?? [],
  } : null

  const isAnyGenerating = isBootstrapping || turns.some((t) => t.isLoading)

  // Decide what to render in the scrollable middle
  const showEmpty  = !isBootstrapping && turns.length === 0
  const showLoader = isBootstrapping
  const showThread = !isBootstrapping && turns.length > 0

  // ── Ask from learning canvas — pre-fill prompt + context, switch to chat ─────
  const handleLearnAsk = useCallback(({ question, sessionId, frameIndex, caption }) => {
    setPauseContext({ sessionId, frameIndex: frameIndex ?? undefined, caption: caption ?? undefined })
    setPrompt(question)
    setViewMode('chat')
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  // ── Learning canvas — full-screen focus mode, bypasses Studio layout ─────────
  if (viewMode === 'learn') {
    return (
      <LearningView
        turns={turns}
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
    }}>

      {/* ── Fixed top header ─────────────────────────────────────────────────── */}
      <Box sx={{
        px: 3, py: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 15, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: theme.palette.text.primary, lineHeight: 1.2 }}>
              Studio
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary }}>
              Visual Learning Lab
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* View mode toggle */}
          <Box sx={{
            display: 'flex',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`,
            borderRadius: '8px',
            p: 0.3, gap: 0.25,
          }}>
            {['Chat', 'Learn'].map((label) => {
              const mode = label.toLowerCase()
              const active = viewMode === mode
              return (
                <Box
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  sx={{
                    px: 1.5, py: 0.4,
                    borderRadius: '6px',
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
          <Tooltip title={notesEnabled ? 'Notes on — click to disable' : 'Notes off — click to enable'}>
            <IconButton
              size="small"
              onClick={toggleNotes}
              sx={{
                borderRadius: '8px', p: 0.75,
                border: `1px solid ${notesEnabled
                  ? (isDark ? 'rgba(79,110,255,0.5)' : '#c7d2fe')
                  : (isDark ? 'rgba(255,255,255,0.18)' : '#d1d5db')}`,
                color: notesEnabled
                  ? theme.palette.primary.main
                  : (isDark ? 'rgba(255,255,255,0.55)' : '#6b7280'),
                backgroundColor: notesEnabled
                  ? (isDark ? 'rgba(79,110,255,0.12)' : '#f0f4ff')
                  : 'transparent',
                '&:hover': {
                  borderColor: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af',
                  color: notesEnabled ? theme.palette.primary.main : (isDark ? '#fff' : '#374151'),
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                },
                transition: 'all 0.15s',
              }}
            >
              <NotesOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {/* New conversation */}
          <Tooltip title="New conversation">
            <IconButton
              size="small"
              onClick={handleNewConversation}
              sx={{
                color: theme.palette.primary.main,
                border: `1px solid ${isDark ? 'rgba(79,110,255,0.3)' : '#c7d2fe'}`,
                borderRadius: '8px', p: 0.75,
                '&:hover': { backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f0f4ff' },
              }}
            >
              <EditOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Body — chat view (learn mode exits early above) ──────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          <HistorySidebar
            conversations={conversations}
            selectedId={activeConvId}
            onSelect={loadConversation}
          />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

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
                <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto', px: { xs: 2.5, sm: 4, md: 5 } }}>
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

              {showThread && (
                <>
                  <ConversationThread turns={turns} onPauseAsk={handlePauseAsk} />
                  <Box ref={threadBottomRef} sx={{ height: 1 }} />
                </>
              )}
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
            />
          </Box>
        </Box>

    </Box>
  )
}
