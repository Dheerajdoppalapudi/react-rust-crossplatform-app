import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box, Typography, TextField, IconButton, Chip,
  Tooltip, CircularProgress, useTheme,
} from '@mui/material'
import AutoAwesomeIcon            from '@mui/icons-material/AutoAwesome'
import SendIcon                   from '@mui/icons-material/Send'
import EditOutlinedIcon           from '@mui/icons-material/EditOutlined'
import AccessTimeIcon             from '@mui/icons-material/AccessTime'
import PlayCircleOutlineIcon      from '@mui/icons-material/PlayCircleOutline'
import MovieCreationOutlinedIcon  from '@mui/icons-material/MovieCreationOutlined'
import CloseIcon                  from '@mui/icons-material/Close'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import { api } from '../services/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_META = {
  process:         { label: 'Mermaid',     bg: '#ede9fe', text: '#6d28d9' },
  architecture:    { label: 'Mermaid',     bg: '#ede9fe', text: '#6d28d9' },
  timeline:        { label: 'Mermaid',     bg: '#ede9fe', text: '#6d28d9' },
  math:            { label: 'Manim',       bg: '#dbeafe', text: '#1d4ed8' },
  concept_analogy: { label: 'Diagram',     bg: '#fef3c7', text: '#b45309' },
  comparison:      { label: 'Diagram',     bg: '#fef3c7', text: '#b45309' },
  illustration:    { label: 'Illustration',bg: '#fce7f3', text: '#be185d' },
}

const ACCENT_BY_INTENT = {
  process: '#c7d2fe', architecture: '#c7d2fe', timeline: '#c7d2fe',
  math: '#bfdbfe', concept_analogy: '#fde68a', comparison: '#fde68a',
  illustration: '#fbcfe8',
}

// Mocked follow-up suggestions per intent type
const FOLLOWUP_SUGGESTIONS = {
  math:            ['Visual proof',         'Real-world example',   'Step by step',           'The converse'],
  illustration:    ['How does it work?',    'More detail',          'Compare with something', 'Show the process'],
  process:         ['Show the failure case','Compare alternatives', 'Explain each step',      'Draw a sequence diagram'],
  architecture:    ['Zoom into one part',   'Show the data flow',   'Scaling strategy',       'Trade-offs'],
  concept_analogy: ['Show me in code',      'Another analogy',      'Common mistakes',        'Practical use'],
  comparison:      ['When to use each?',    'Performance comparison','Real example',           'Trade-offs'],
  timeline:        ['What happened between?','Key turning points',  "What's next?",           'The impact'],
}

const SUGGESTIONS = [
  "Newton's laws of motion",
  "How does TCP/IP work?",
  "Pythagorean theorem",
  "How does recursion work?",
  "HTTP vs HTTPS",
]

// videoPhase values: 'generating' | 'ready' | 'error'

function relativeTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getFrameType(imagePath) {
  if (!imagePath) return 'placeholder'
  if (imagePath.toLowerCase().endsWith('.mp4')) return 'video'
  if (imagePath.toLowerCase().endsWith('.png')) return 'image'
  return 'placeholder'
}

// ─── Session card ─────────────────────────────────────────────────────────────

const SessionCard = ({ session, isSelected, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const meta   = INTENT_META[session.intent_type] || { label: session.intent_type || '?', bg: '#f1f5f9', text: '#64748b' }
  const accent = ACCENT_BY_INTENT[session.intent_type] || '#e2e8f0'

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5, mb: 0.5, borderRadius: '10px', cursor: 'pointer', border: '1px solid',
        borderColor: isSelected ? theme.palette.primary.main + '55' : 'transparent',
        backgroundColor: isSelected
          ? isDark ? 'rgba(79,110,255,0.1)' : 'rgba(0,26,255,0.05)'
          : 'transparent',
        '&:hover': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: theme.palette.divider,
        },
        transition: 'all 0.15s',
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        {Array.from({ length: Math.min(session.frame_count || 2, 3) }).map((_, i) => (
          <Box key={i} sx={{ flex: 1, height: 26, borderRadius: '5px', backgroundColor: isDark ? accent + '55' : accent, opacity: 0.5 + i * 0.2 }} />
        ))}
      </Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.75 }}>
        {session.prompt}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip
          label={meta.label}
          size="small"
          sx={{ height: 18, fontSize: 10, fontWeight: 600, backgroundColor: meta.bg, color: meta.text, '& .MuiChip-label': { px: 0.75 } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AccessTimeIcon sx={{ fontSize: 10, color: theme.palette.text.secondary, opacity: 0.5 }} />
          <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.5 }}>
            {relativeTime(session.created_at)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Loading view (frame generation) ─────────────────────────────────────────

const LoadingView = ({ stage }) => {
  const theme   = useTheme()
  const stages  = ['planning', 'generating', 'rendering']
  const current = stages.indexOf(stage)
  const labels  = { planning: 'Planning frames…', generating: 'Generating visuals…', rendering: 'Rendering…' }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress size={52} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AutoAwesomeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: theme.palette.text.primary, mb: 0.5 }}>
          {labels[stage]}
        </Typography>
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>This takes a few seconds</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {stages.map((s, i) => (
          <Box key={s} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: i <= current ? theme.palette.primary.main : theme.palette.divider, transition: 'all 0.3s' }} />
            <Typography sx={{ fontSize: 10, fontWeight: i === current ? 600 : 400, color: i === current ? theme.palette.primary.main : theme.palette.text.secondary, opacity: i === current ? 1 : 0.5 }}>
              {s}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Empty view ───────────────────────────────────────────────────────────────

const EmptyView = ({ onSuggestionClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5 }}>
      <Box sx={{ width: 60, height: 60, background: isDark ? 'linear-gradient(135deg, rgba(79,110,255,0.15) 0%, rgba(79,110,255,0.08) 100%)' : 'linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isDark ? 'rgba(79,110,255,0.2)' : '#e0e8ff'}` }}>
        <AutoAwesomeIcon sx={{ fontSize: 26, color: theme.palette.primary.main, opacity: 0.8 }} />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17, color: theme.palette.text.primary, mb: 0.75 }}>What do you want to learn?</Typography>
        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, maxWidth: 340, lineHeight: 1.6 }}>
          Type a topic and Falcon will generate a visual lesson — diagrams, animations, or illustrations.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 480, mt: 0.5 }}>
        {SUGGESTIONS.map((s) => (
          <Box key={s} onClick={() => onSuggestionClick(s)} sx={{ px: 1.5, py: 0.75, borderRadius: '20px', border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, cursor: 'pointer', fontSize: 12.5, color: theme.palette.text.secondary, userSelect: 'none', '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main, backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f5f7ff' }, transition: 'all 0.15s' }}>
            {s}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Frame thumbnail ──────────────────────────────────────────────────────────

const FrameThumbnail = ({ sessionId, frameIndex, caption, type, isActive, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [imgError, setImgError] = useState(false)

  const showPlaceholder = type !== 'image' || imgError

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 128, height: 76, flexShrink: 0,
        borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
        border: `2px solid ${isActive ? theme.palette.primary.main : (isDark ? '#2a2a2a' : '#e2e8f0')}`,
        position: 'relative',
        backgroundColor: isDark ? '#141414' : '#f1f5f9',
        transition: 'all 0.15s',
        '&:hover': { borderColor: theme.palette.primary.main, transform: 'scale(1.03)' },
      }}
    >
      {!showPlaceholder ? (
        <img
          src={api.getFrameUrl(sessionId, frameIndex)}
          alt={caption}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, p: 0.75 }}>
          {type === 'video'
            ? <PlayCircleOutlineIcon sx={{ fontSize: 22, color: theme.palette.primary.main, opacity: 0.7 }} />
            : <AutoAwesomeIcon sx={{ fontSize: 18, color: theme.palette.text.secondary, opacity: 0.35 }} />
          }
          <Typography sx={{ fontSize: 9, color: theme.palette.text.secondary, opacity: 0.7, textAlign: 'center', lineHeight: 1.3, px: 0.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {caption}
          </Typography>
        </Box>
      )}

      {/* Frame number badge */}
      <Box sx={{ position: 'absolute', top: 3, left: 3, minWidth: 16, height: 16, borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
        <Typography sx={{ fontSize: 8, color: '#fff', fontWeight: 700, lineHeight: 1 }}>{frameIndex + 1}</Typography>
      </Box>
    </Box>
  )
}

// ─── Frame strip ──────────────────────────────────────────────────────────────

const FrameStrip = ({ sessionId, framesData, activeFrame, onFrameClick }) => {
  const theme = useTheme()
  if (!framesData?.captions?.length) return null

  const { images = [], captions } = framesData

  return (
    <Box sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', flexShrink: 0 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: theme.palette.text.secondary, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1 }}>
        Frames · {captions.length}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 3 }, '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 } }}>
        {captions.map((caption, i) => (
          <FrameThumbnail
            key={i}
            sessionId={sessionId}
            frameIndex={i}
            caption={caption}
            type={getFrameType(images[i])}
            isActive={activeFrame === i}
            onClick={() => onFrameClick(i)}
          />
        ))}
      </Box>
    </Box>
  )
}

// ─── Video panel ──────────────────────────────────────────────────────────────

const VideoPanel = ({ sessionId, videoPhase }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  if (videoPhase === 'generating') {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5, mx: 3, mb: 2, borderRadius: '14px', border: `1px solid ${theme.palette.divider}`, backgroundColor: isDark ? '#0d0d0d' : '#f8fafc', minHeight: 220 }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress size={46} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MovieCreationOutlinedIcon sx={{ fontSize: 19, color: theme.palette.primary.main }} />
          </Box>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14.5, color: theme.palette.text.primary, mb: 0.5 }}>
            Generating video…
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
            Rendering animations and narration audio
          </Typography>
        </Box>
      </Box>
    )
  }

  if (videoPhase === 'ready') {
    return (
      <Box sx={{ flex: 1, mx: 3, mb: 2, borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
        <video
          src={api.getVideoUrl(sessionId)}
          controls
          style={{ width: '100%', maxHeight: '420px', display: 'block', objectFit: 'contain' }}
        />
      </Box>
    )
  }

  // 'error' state
  if (videoPhase === 'error') {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
          Video generation failed. Check the server logs.
        </Typography>
      </Box>
    )
  }

  return null
}

// ─── Question header ──────────────────────────────────────────────────────────

const QuestionHeader = ({ prompt, intentType, frameCount }) => {
  const theme = useTheme()
  const meta  = INTENT_META[intentType] || { label: intentType || '?', bg: '#f1f5f9', text: '#64748b' }

  return (
    <Box sx={{ px: 3, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
      <Typography sx={{ fontSize: 17, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.4, mb: 1 }}>
        {prompt}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={`${meta.label} · ${frameCount ?? '?'} frame${frameCount !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 22, fontSize: 11.5, fontWeight: 600, backgroundColor: meta.bg, color: meta.text }}
        />
      </Box>
    </Box>
  )
}

// ─── Session view — question + video + frames ─────────────────────────────────

const SessionView = ({ session, videoPhase, framesData }) => {
  const [activeFrame, setActiveFrame] = useState(0)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <QuestionHeader
        prompt={session.prompt}
        intentType={session.intent_type}
        frameCount={session.frame_count}
      />

      {/* Video area — fills remaining space */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <VideoPanel sessionId={session.id} videoPhase={videoPhase} />
      </Box>

      {/* Frame strip — always shown once frames data is loaded */}
      {framesData && (
        <FrameStrip
          sessionId={session.id}
          framesData={framesData}
          activeFrame={activeFrame}
          onFrameClick={setActiveFrame}
        />
      )}
    </Box>
  )
}

// ─── Studio (main) ────────────────────────────────────────────────────────────

export default function Studio() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Prompt + input
  const [prompt, setPrompt]             = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [stage, setStage]               = useState('planning')
  const inputRef = useRef(null)

  // Session state
  const [sessions, setSessions]             = useState([])
  const [selectedId, setSelectedId]         = useState(null)
  const [currentSession, setCurrentSession] = useState(null)   // { id, prompt, intent_type, frame_count }
  const [framesData, setFramesData]         = useState(null)   // { images, captions, render_path }
  const [videoPhase, setVideoPhase]         = useState('generating') // 'generating' | 'ready' | 'error'

  // Follow-up context (set once a session is active)
  const [followUpCtx, setFollowUpCtx] = useState(null)  // { id, prompt, intent_type }

  // ── Session history ──────────────────────────────────────────────────────────
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

  // ── Load session from history ─────────────────────────────────────────────────
  const loadSession = useCallback(async (session) => {
    setSelectedId(session.id)
    setCurrentSession(session)
    setFramesData(null)
    setVideoPhase('generating')   // show spinner while we check
    setFollowUpCtx({ id: session.id, prompt: session.prompt, intent_type: session.intent_type })

    // Load frame metadata
    try {
      const data = await api.getFramesMeta(session.id)
      if (data) setFramesData(data)
    } catch (err) {
      console.error('[Studio] getFramesMeta:', err)
    }

    // Check if video already exists (HEAD request)
    const videoExists = await api.checkVideoExists(session.id)
    if (videoExists) {
      setVideoPhase('ready')
    } else {
      runVideoGeneration(session.id)
    }
  }, [runVideoGeneration])

  // ── Main generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    const submittedPrompt = prompt.trim()
    setIsGenerating(true)
    setCurrentSession(null)
    setFramesData(null)
    setSelectedId(null)
    setStage('planning')

    const t1 = setTimeout(() => setStage('generating'), 2500)
    const t2 = setTimeout(() => setStage('rendering'),  6000)

    try {
      const data = await api.imageGeneration(submittedPrompt)

      const session = {
        id:           data.session_id,
        prompt:       submittedPrompt,
        intent_type:  data.intent_type,
        frame_count:  data.frame_count,
        render_path:  data.render_path,
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

      // Generate video in background (no await — don't block UI)
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

  // ── Follow-up suggestions (mocked) ────────────────────────────────────────────
  const suggestions = followUpCtx
    ? (FOLLOWUP_SUGGESTIONS[followUpCtx.intent_type] || FOLLOWUP_SUGGESTIONS.illustration)
    : []

  const isFollowUpMode   = !!followUpCtx && !isGenerating
  const promptPlaceholder = isFollowUpMode ? 'Ask a follow-up question…' : 'What do you want to visualize today?'
  const canSend           = prompt.trim() && !isGenerating
  const promptBg          = isDark ? '#1f1f1f' : '#fafafa'
  const promptBorder      = isDark ? '#2e2e2e' : '#e2e8f0'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

      {/* Page header */}
      <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 30, height: 30, background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AutoAwesomeIcon sx={{ fontSize: 15, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: theme.palette.text.primary, lineHeight: 1.2 }}>Studio</Typography>
            <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary }}>Visual Learning Lab</Typography>
          </Box>
        </Box>
        <Tooltip title="New session">
          <IconButton
            size="small"
            onClick={handleReset}
            sx={{ color: theme.palette.primary.main, border: `1px solid ${isDark ? 'rgba(79,110,255,0.3)' : '#c7d2fe'}`, borderRadius: '8px', p: 0.75, '&:hover': { backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f0f4ff' } }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* History sidebar */}
        <Box sx={{ width: 248, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ px: 2, pt: 2, pb: 0.75 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.7px', opacity: 0.7 }}>
              History
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
            {sessions.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, pt: 3, textAlign: 'center', opacity: 0.5 }}>
                No sessions yet
              </Typography>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isSelected={selectedId === s.id}
                  onClick={() => loadSession(s)}
                />
              ))
            )}
          </Box>
        </Box>

        {/* Main area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Content area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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

          {/* Follow-up suggestions — shown when video is ready and not actively generating */}
          {isFollowUpMode && suggestions.length > 0 && (
            <Box sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.55, mb: 0.75 }}>
                Suggested follow-ups
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {suggestions.map((s) => (
                  <Box
                    key={s}
                    onClick={() => { setPrompt(s); inputRef.current?.focus() }}
                    sx={{
                      px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer',
                      border: `1px solid ${theme.palette.divider}`,
                      fontSize: 12, color: theme.palette.text.secondary, userSelect: 'none',
                      '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main, backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f5f7ff' },
                      transition: 'all 0.15s',
                    }}
                  >
                    {s}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Prompt / follow-up bar */}
          <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', flexShrink: 0 }}>

            {/* Follow-up context indicator */}
            {isFollowUpMode && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <SubdirectoryArrowRightIcon sx={{ fontSize: 13, color: theme.palette.text.secondary, opacity: 0.45 }} />
                <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, opacity: 0.55, flexShrink: 0 }}>
                  Following up on:
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: theme.palette.primary.main, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  "{followUpCtx.prompt}"
                </Typography>
                <Tooltip title="Start new question">
                  <IconButton
                    size="small"
                    onClick={() => setFollowUpCtx(null)}
                    sx={{ p: 0.3, color: theme.palette.text.secondary, opacity: 0.5, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                  >
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, border: `1.5px solid ${promptBorder}`, borderRadius: '12px', px: 2, py: 1, backgroundColor: promptBg, '&:focus-within': { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.background.paper }, transition: 'all 0.15s' }}>
              <TextField
                inputRef={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={promptPlaceholder}
                multiline
                maxRows={4}
                disabled={isGenerating}
                variant="standard"
                fullWidth
                slotProps={{ input: { disableUnderline: true } }}
                sx={{ '& .MuiInputBase-input': { fontSize: 14, color: theme.palette.text.primary, py: 0.25, '&::placeholder': { color: theme.palette.text.secondary, opacity: 0.6 } } }}
              />
              <Tooltip title="Generate (Enter)">
                <span>
                  <IconButton
                    onClick={handleGenerate}
                    disabled={!canSend}
                    size="small"
                    sx={{ width: 34, height: 34, flexShrink: 0, mb: 0.25, backgroundColor: canSend ? theme.palette.primary.main : (isDark ? '#2a2a2a' : '#f1f5f9'), color: canSend ? '#fff' : theme.palette.text.secondary, '&:hover': { backgroundColor: canSend ? (isDark ? '#3D58FF' : '#0015cc') : undefined }, transition: 'all 0.15s' }}
                  >
                    {isGenerating
                      ? <CircularProgress size={14} sx={{ color: theme.palette.text.secondary }} />
                      : <SendIcon sx={{ fontSize: 14 }} />
                    }
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.45, mt: 0.75, ml: 0.5 }}>
              Enter to generate · Shift+Enter for new line
            </Typography>
          </Box>

        </Box>
      </Box>
    </Box>
  )
}
