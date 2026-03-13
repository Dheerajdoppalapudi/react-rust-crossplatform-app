import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import EditOutlinedIcon  from '@mui/icons-material/EditOutlined'

import HistorySidebar from '../components/Studio/HistorySidebar'
import LoadingView    from '../components/Studio/LoadingView'
import EmptyView      from '../components/Studio/EmptyView'
import SessionView    from '../components/Studio/SessionView'
import PromptBar      from '../components/Studio/PromptBar'

import { api } from '../services/api'

// ─── Studio (main page orchestrator) ──────────────────────────────────────────
export default function Studio() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // ── Input state ──────────────────────────────────────────────────────────────
  const [prompt, setPrompt]             = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [stage, setStage]               = useState('planning')
  const inputRef = useRef(null)

  // ── Session state ─────────────────────────────────────────────────────────────
  const [sessions, setSessions]             = useState([])
  const [selectedId, setSelectedId]         = useState(null)
  const [currentSession, setCurrentSession] = useState(null)
  const [framesData, setFramesData]         = useState(null)
  const [videoPhase, setVideoPhase]         = useState('generating') // 'generating' | 'ready' | 'error'

  // ── Follow-up context ─────────────────────────────────────────────────────────
  const [followUpCtx, setFollowUpCtx] = useState(null)  // { id, prompt, intent_type }

  // Ref for the scrollable content area — scroll to top when new session starts
  const contentScrollRef = useRef(null)

  // ── Fetch session history ─────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.getSessions()
      setSessions(data)
    } catch (err) {
      console.error('[Studio] fetchSessions:', err)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ── Background video generation ───────────────────────────────────────────────
  const runVideoGeneration = useCallback(async (sessionId) => {
    try {
      const data = await api.generateVideo(sessionId)
      if (data.video_path) {
        setVideoPhase('ready')
      } else {
        setVideoPhase('error')
      }
    } catch (err) {
      console.error('[Studio] generateVideo:', err)
      setVideoPhase('error')
    }
  }, [])

  // ── Load session from history ──────────────────────────────────────────────────
  const loadSession = useCallback(async (session) => {
    setSelectedId(session.id)
    setCurrentSession(session)
    setFramesData(null)
    setVideoPhase('generating')
    setFollowUpCtx({ id: session.id, prompt: session.prompt, intent_type: session.intent_type })

    // Scroll content area to top
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0

    // Load frame metadata
    try {
      const data = await api.getFramesMeta(session.id)
      if (data) setFramesData(data)
    } catch (err) {
      console.error('[Studio] getFramesMeta:', err)
    }

    // Check if video already exists — skip generation if so
    const videoExists = await api.checkVideoExists(session.id)
    if (videoExists) {
      setVideoPhase('ready')
    } else {
      runVideoGeneration(session.id)
    }
  }, [runVideoGeneration])

  // ── Main generate handler ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    const submittedPrompt = prompt.trim()
    setIsGenerating(true)
    setCurrentSession(null)
    setFramesData(null)
    setSelectedId(null)
    setStage('planning')

    // Scroll content area to top
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0

    const t1 = setTimeout(() => setStage('generating'), 2500)
    const t2 = setTimeout(() => setStage('rendering'),  6000)

    try {
      const data = await api.imageGeneration(submittedPrompt)

      const session = {
        id:          data.session_id,
        prompt:      submittedPrompt,
        intent_type: data.intent_type,
        frame_count: data.frame_count,
        render_path: data.render_path,
      }
      const frames = {
        render_path: data.render_path,
        images:      data.images   || [],
        captions:    data.captions || [],
      }

      setCurrentSession(session)
      setSelectedId(data.session_id)
      setFramesData(frames)
      setFollowUpCtx({ id: data.session_id, prompt: submittedPrompt, intent_type: data.intent_type })
      setVideoPhase('generating')
      setPrompt('')

      await fetchSessions()

      // Generate video in background — don't block the UI
      runVideoGeneration(data.session_id)
    } catch (err) {
      console.error('[Studio] handleGenerate:', err)
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setIsGenerating(false)
    }
  }, [prompt, isGenerating, fetchSessions, runVideoGeneration])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }

  const handleReset = () => {
    setCurrentSession(null)
    setFramesData(null)
    setSelectedId(null)
    setFollowUpCtx(null)
    setPrompt('')
    inputRef.current?.focus()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',          // prevents Studio from expanding past the viewport
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

        <Tooltip title="New session">
          <IconButton
            size="small"
            onClick={handleReset}
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

        {/* ── Left: History sidebar (independent scroll) ────────────────────── */}
        <HistorySidebar
          sessions={sessions}
          selectedId={selectedId}
          onSelect={loadSession}
        />

        {/* ── Right: Main content column ────────────────────────────────────── */}
        <Box sx={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
        }}>

          {/* ── Scrollable middle ──────────────────────────────────────────────
              Everything between the header and the prompt bar lives here.
              This is the ONLY scrollable region on the right side.           */}
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
            {isGenerating ? (
              <LoadingView stage={stage} />
            ) : currentSession ? (
              <SessionView
                session={currentSession}
                videoPhase={videoPhase}
                framesData={framesData}
              />
            ) : (
              <EmptyView onSuggestionClick={(s) => { setPrompt(s); inputRef.current?.focus() }} />
            )}
          </Box>

          {/* ── Fixed bottom prompt bar ───────────────────────────────────────── */}
          <PromptBar
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={handleGenerate}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            isGenerating={isGenerating}
            followUpCtx={followUpCtx}
            onClearFollowUp={() => setFollowUpCtx(null)}
          />
        </Box>
      </Box>
    </Box>
  )
}
