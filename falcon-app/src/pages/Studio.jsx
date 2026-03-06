import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  useTheme,
} from '@mui/material'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import SendIcon           from '@mui/icons-material/Send'
import EditOutlinedIcon   from '@mui/icons-material/EditOutlined'
import AccessTimeIcon     from '@mui/icons-material/AccessTime'

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_META = {
  process:         { label: 'Mermaid',  bg: '#ede9fe', text: '#6d28d9' },
  architecture:    { label: 'Mermaid',  bg: '#ede9fe', text: '#6d28d9' },
  timeline:        { label: 'Mermaid',  bg: '#ede9fe', text: '#6d28d9' },
  math:            { label: 'Manim',    bg: '#dbeafe', text: '#1d4ed8' },
  concept_analogy: { label: 'Diagram',  bg: '#fef3c7', text: '#b45309' },
  comparison:      { label: 'Diagram',  bg: '#fef3c7', text: '#b45309' },
  illustration:    { label: 'Diagram',  bg: '#fce7f3', text: '#be185d' },
}

const ACCENT_BY_INTENT = {
  process: '#c7d2fe', architecture: '#c7d2fe', timeline: '#c7d2fe',
  math: '#bfdbfe', concept_analogy: '#fde68a', comparison: '#fde68a',
}

const STAGE_LABELS = {
  planning:   'Planning frames…',
  generating: 'Generating visuals…',
  rendering:  'Rendering…',
}

const SUGGESTIONS = [
  "Newton's laws of motion",
  "How does TCP/IP work?",
  "Pythagorean theorem",
  "How does recursion work?",
  "HTTP vs HTTPS",
]

function relativeTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
      {/* Thumbnail strip */}
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

// ─── Loading view ─────────────────────────────────────────────────────────────
const LoadingView = ({ stage }) => {
  const theme   = useTheme()
  const stages  = ['planning', 'generating', 'rendering']
  const current = stages.indexOf(stage)

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
          {STAGE_LABELS[stage]}
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

// ─── Output view (code / JSON viewer) ────────────────────────────────────────
const OutputView = ({ output, meta }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const codeBg     = isDark ? '#0d0d0d' : '#f8f8f8'
  const codeBorder = isDark ? '#2a2a2a' : '#e2e8f0'
  const codeColor  = isDark ? '#e2e8f0' : '#1e293b'

  const intentMeta = meta ? (INTENT_META[meta.intent_type] || {}) : {}
  const label      = intentMeta.label || meta?.intent_type || ''

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 3 }}>
      {/* Header bar */}
      {meta && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexShrink: 0 }}>
          {label && (
            <Chip
              label={`${label} · ${meta.frame_count ?? '?'} frames`}
              size="small"
              sx={{ height: 22, fontSize: 11.5, fontWeight: 600, backgroundColor: intentMeta.bg || '#f1f5f9', color: intentMeta.text || '#64748b' }}
            />
          )}
          <Chip
            label={output.file_type === 'python' ? 'Python' : 'JSON'}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: 11, fontWeight: 500 }}
          />
          {meta.api_call_count != null && (
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary }}>
              {meta.api_call_count} LLM call{meta.api_call_count !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      )}

      {/* Code block */}
      <Box
        sx={{
          flex: 1, overflow: 'auto', borderRadius: '10px',
          border: `1px solid ${codeBorder}`, backgroundColor: codeBg,
        }}
      >
        <Box
          component="pre"
          sx={{
            m: 0, p: 2.5,
            fontSize: 12.5,
            lineHeight: 1.65,
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            color: codeColor,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {output.content}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Studio() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [prompt, setPrompt]         = useState('')
  const [isGenerating, setIsGen]    = useState(false)
  const [stage, setStage]           = useState('planning')
  const [sessions, setSessions]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [output, setOutput]         = useState(null)   // { file_type, content }
  const [outputMeta, setOutputMeta] = useState(null)   // session row for header
  const [loadingOutput, setLoadingOutput] = useState(false)
  const inputRef = useRef(null)

  // ── Fetch session history ──────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res  = await fetch('http://localhost:8000/api/sessions')
      const data = await res.json()
      setSessions(data)
    } catch (err) {
      console.error('[Studio] fetchSessions:', err)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ── Load output for a session ─────────────────────────────────────────────
  const loadOutput = async (session) => {
    setSelectedId(session.id)
    setOutputMeta(session)
    setOutput(null)
    setLoadingOutput(true)
    try {
      const res  = await fetch(`http://localhost:8000/api/sessions/${session.id}/output`)
      const data = await res.json()
      if (data.content) setOutput(data)
    } catch (err) {
      console.error('[Studio] loadOutput:', err)
    } finally {
      setLoadingOutput(false)
    }
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return
    setIsGen(true)
    setOutput(null)
    setOutputMeta(null)
    setSelectedId(null)
    setStage('planning')

    const t1 = setTimeout(() => setStage('generating'), 2500)
    const t2 = setTimeout(() => setStage('rendering'),  6000)

    try {
      const form = new FormData()
      form.append('message', prompt.trim())
      const res  = await fetch('http://localhost:8000/api/image_generation', { method: 'POST', body: form })
      const data = await res.json()

      // Refresh history and auto-select new session
      await fetchSessions()
      setSelectedId(data.session_id)

      // Show output immediately (for json path we have excalidraw inline)
      const outputRes = await fetch(`http://localhost:8000/api/sessions/${data.session_id}/output`)
      const outputData = await outputRes.json()
      if (outputData.content) setOutput(outputData)

      // Build meta from response
      setOutputMeta({
        intent_type: data.intent_type,
        frame_count: data.frame_count,
        render_path: data.render_path,
        api_call_count: null, // will refresh from sessions list
      })

      setPrompt('')
    } catch (err) {
      console.error('[Studio]', err)
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setIsGen(false)
      // Refresh again to get api_call_count from DB
      fetchSessions().then(() => {
        setSessions((prev) => {
          const s = prev.find((x) => x.id === selectedId)
          if (s) setOutputMeta(s)
          return prev
        })
      })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }

  const promptBg     = isDark ? '#1f1f1f' : '#fafafa'
  const promptBorder = isDark ? '#2e2e2e' : '#e2e8f0'
  const canSend      = prompt.trim() && !isGenerating

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
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
            onClick={() => { setOutput(null); setOutputMeta(null); setSelectedId(null); setPrompt(''); inputRef.current?.focus() }}
            sx={{ color: theme.palette.primary.main, border: `1px solid ${isDark ? 'rgba(79,110,255,0.3)' : '#c7d2fe'}`, borderRadius: '8px', p: 0.75, '&:hover': { backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f0f4ff' } }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left: Session history */}
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
                  onClick={() => loadOutput(s)}
                />
              ))
            )}
          </Box>
        </Box>

        {/* Right: Viewer + Prompt */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Viewer */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {isGenerating ? (
              <LoadingView stage={stage} />
            ) : loadingOutput ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
              </Box>
            ) : output ? (
              <OutputView output={output} meta={outputMeta} />
            ) : (
              <EmptyView onSuggestionClick={(s) => { setPrompt(s); inputRef.current?.focus() }} />
            )}
          </Box>

          {/* Prompt bar */}
          <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, border: `1.5px solid ${promptBorder}`, borderRadius: '12px', px: 2, py: 1, backgroundColor: promptBg, '&:focus-within': { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.background.paper }, transition: 'all 0.15s' }}>
              <TextField
                inputRef={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What do you want to visualize today?"
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
