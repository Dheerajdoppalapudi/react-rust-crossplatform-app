import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import HistorySidebar      from '../components/Studio/HistorySidebar'
import LoadingView         from '../components/Studio/LoadingView'
import EmptyView           from '../components/Studio/EmptyView'
import ConversationThread  from '../components/Studio/ConversationThread'
import PromptBar           from '../components/Studio/PromptBar'

import { api } from '../services/api'

// ─── Studio ────────────────────────────────────────────────────────────────────
export default function Studio() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

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
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [bootstrapStage, setBootstrapStage]   = useState('planning')

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
  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId) => {
    try {
      const data = await api.generateVideo(sessionId)
      setTurnVideoPhase(tempId, sessionId, data.video_path ? 'ready' : 'error')
    } catch {
      setTurnVideoPhase(tempId, sessionId, 'error')
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
      tempId:     t.id,
      id:         t.id,
      prompt:     t.prompt,
      intent_type: t.intent_type,
      render_path: t.render_path,
      frame_count: t.frame_count,
      isLoading:  false,
      framesData: null,
      videoPhase: t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating'),
    }))

    setTurns(loadedTurns)

    // Load frames meta + trigger missing video generation for each turn
    loadedTurns.forEach(async (turn) => {
      try {
        const framesData = await api.getFramesMeta(turn.id)
        if (framesData) {
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
    if (!prompt.trim() || isBootstrapping) return

    const submittedPrompt = prompt.trim()
    setPrompt('')

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    if (isFirstTurn) {
      // Show full-screen loader before we have any turns
      setIsBootstrapping(true)
      setBootstrapStage('planning')
      setTurns([])
      if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
    } else {
      // Append a loading placeholder turn to the thread
      setTurns((prev) => [...prev, {
        tempId,
        id:          null,
        prompt:      submittedPrompt,
        intent_type: null,
        render_path: null,
        frame_count: null,
        isLoading:   true,
        stage:       'planning',
        framesData:  null,
        videoPhase:  'generating',
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

    try {
      const data = await api.imageGeneration(submittedPrompt, activeConvId)

      const framesData = {
        render_path: data.render_path,
        images:      data.images   || [],
        captions:    data.captions || [],
      }
      const realTurn = {
        tempId,
        id:          data.session_id,
        conversation_id: data.conversation_id,
        turn_index:  data.turn_index,
        prompt:      submittedPrompt,
        intent_type: data.intent_type,
        render_path: data.render_path,
        frame_count: data.frame_count,
        isLoading:   false,
        stage:       null,
        framesData,
        videoPhase:  'generating',
      }

      if (isFirstTurn) {
        setActiveConvId(data.conversation_id)
        setIsBootstrapping(false)
        setTurns([realTurn])
      } else {
        setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
      }

      await fetchConversations()
      runVideoGenerationForTurn(tempId, data.session_id)
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
  }, [prompt, isBootstrapping, activeConvId, fetchConversations, runVideoGenerationForTurn])

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

  // The last intent type in the thread (used for follow-up suggestions)
  const lastIntentType = turns.filter((t) => t.intent_type).at(-1)?.intent_type ?? null
  const activeConversationMeta = activeConvId
    ? { id: activeConvId, intent_type: lastIntentType }
    : null

  // Decide what to render in the scrollable middle
  const showEmpty  = !isBootstrapping && turns.length === 0
  const showLoader = isBootstrapping
  const showThread = !isBootstrapping && turns.length > 0

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

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left: Conversations sidebar ───────────────────────────────────── */}
        <HistorySidebar
          conversations={conversations}
          selectedId={activeConvId}
          onSelect={loadConversation}
        />

        {/* ── Right: Main content column ────────────────────────────────────── */}
        <Box sx={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
        }}>

          {/* ── Scrollable middle ─────────────────────────────────────────────── */}
          <Box
            ref={contentScrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
            }}
          >
            {showLoader && <LoadingView stage={bootstrapStage} />}

            {showEmpty && (
              <EmptyView onSuggestionClick={(s) => { setPrompt(s); inputRef.current?.focus() }} />
            )}

            {showThread && (
              <>
                <ConversationThread turns={turns} />
                {/* Invisible anchor for auto-scroll */}
                <Box ref={threadBottomRef} sx={{ height: 1 }} />
              </>
            )}
          </Box>

          {/* ── Fixed bottom prompt bar ───────────────────────────────────────── */}
          <PromptBar
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={handleGenerate}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            isGenerating={isBootstrapping}
            activeConversation={activeConversationMeta}
            onNewConversation={handleNewConversation}
          />
        </Box>
      </Box>
    </Box>
  )
}
