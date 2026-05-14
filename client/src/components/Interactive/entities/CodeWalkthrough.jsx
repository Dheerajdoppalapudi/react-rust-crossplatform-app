import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Tooltip, IconButton, Chip,
         LinearProgress, Select, MenuItem, useTheme } from '@mui/material'
import ContentCopyIcon  from '@mui/icons-material/ContentCopy'
import CheckIcon        from '@mui/icons-material/Check'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import SkipNextIcon     from '@mui/icons-material/SkipNext'
import PlayArrowIcon    from '@mui/icons-material/PlayArrow'
import PauseIcon        from '@mui/icons-material/Pause'
import ReplayIcon       from '@mui/icons-material/Replay'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark }  from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'

// ── Language registrations ────────────────────────────────────────────────────
import python     from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import java       from 'react-syntax-highlighter/dist/esm/languages/hljs/java'
import cpp        from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp'
import c          from 'react-syntax-highlighter/dist/esm/languages/hljs/c'
import go         from 'react-syntax-highlighter/dist/esm/languages/hljs/go'
import sql        from 'react-syntax-highlighter/dist/esm/languages/hljs/sql'
import bash       from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import xml        from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'  // covers html + xml

SyntaxHighlighter.registerLanguage('python',     python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('java',       java)
SyntaxHighlighter.registerLanguage('cpp',        cpp)
SyntaxHighlighter.registerLanguage('c',          c)
SyntaxHighlighter.registerLanguage('go',         go)
SyntaxHighlighter.registerLanguage('sql',        sql)
SyntaxHighlighter.registerLanguage('bash',       bash)
SyntaxHighlighter.registerLanguage('shell',      bash)
SyntaxHighlighter.registerLanguage('html',       xml)
SyntaxHighlighter.registerLanguage('xml',        xml)

const SPEED_OPTIONS = [
  { label: '2s',  value: 2000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
]

export default function CodeWalkthrough({
  entityId,
  language = 'python',
  code     = '',
  steps    = [],
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Self-contained step state — no dependency on useSceneStore
  const [step,          setStep]          = useState(0)
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [autoInterval,  setAutoInterval]  = useState(3000)
  const [copied,        setCopied]        = useState(false)

  const total    = steps.length
  const atStart  = step === 0
  const atEnd    = step === total - 1
  const finished = atEnd && !isPlaying && step > 0
  const progress = total > 1 ? (step / (total - 1)) * 100 : 100

  const currentStep   = steps[step] ?? steps[0]
  const highlightLine = currentStep?.line ?? null
  const explanation   = currentStep?.explanation ?? ''
  const stepLabel     = steps[step] ? `Step ${step + 1} of ${total}` : ''

  // Auto-play
  const advanceRef = useRef(null)
  const advance    = useCallback(() => {
    setStep(prev => {
      if (prev >= total - 1) { setIsPlaying(false); return prev }
      return prev + 1
    })
  }, [total])
  advanceRef.current = advance

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => advanceRef.current?.(), autoInterval)
    return () => clearInterval(id)
  }, [isPlaying, autoInterval])

  // Keyboard navigation (only when not in a text input)
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advanceRef.current?.() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setIsPlaying(false); setStep(s => Math.max(0, s - 1)) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const prev    = () => { setIsPlaying(false); setStep(s => Math.max(0, s - 1)) }
  const next    = () => { setIsPlaying(false); setStep(s => Math.min(total - 1, s + 1)) }
  const restart = () => { setStep(0); setIsPlaying(true) }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [code])

  const lineProps = (lineNumber) => {
    if (lineNumber === highlightLine) {
      return {
        style: {
          display: 'block',
          backgroundColor: isDark ? 'rgba(74,171,255,0.18)' : 'rgba(24,71,214,0.10)',
          borderLeft: `3px solid ${isDark ? '#4dabf7' : '#1847D6'}`,
          paddingLeft: '8px',
          marginLeft: '-8px',
        },
      }
    }
    return {}
  }

  const accentColor = isDark ? '#4dabf7' : '#1847D6'
  const surfaceBg   = isDark ? '#161b22' : '#f6f8fa'

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>

      {/* ── Header: language badge + line indicator + copy ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75,
        backgroundColor: surfaceBg,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Chip
          label={language}
          size="small"
          sx={{
            height: 20, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
          }}
        />
        {highlightLine && (
          <Typography sx={{ fontSize: 11, color: accentColor, opacity: 0.85 }}>
            Line {highlightLine}
          </Typography>
        )}
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
          <IconButton size="small" onClick={handleCopy} aria-label="Copy code"
            sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', width: 24, height: 24 }}>
            {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Code block ── */}
      <SyntaxHighlighter
        language={language}
        style={isDark ? atomOneDark : atomOneLight}
        showLineNumbers
        wrapLines
        lineProps={lineProps}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: 13.5, lineHeight: 1.6 }}
      >
        {code}
      </SyntaxHighlighter>

      {/* ── Explanation panel ── */}
      {explanation && (
        <Paper elevation={0} sx={{
          px: 2, py: 1.5,
          borderTop: '1px solid', borderColor: 'divider',
          borderRadius: 0,
          backgroundColor: isDark ? 'rgba(74,171,255,0.06)' : 'rgba(24,71,214,0.04)',
        }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55, fontSize: 13 }}>
            {explanation}
          </Typography>
        </Paper>
      )}

      {/* ── Built-in step controls ── */}
      {total > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1,
          borderTop: '1px solid', borderColor: 'divider',
          backgroundColor: surfaceBg,
        }}>
          {/* Restart / Play / Pause */}
          {finished ? (
            <Tooltip title="Restart">
              <IconButton size="small" onClick={restart} aria-label="Restart">
                <ReplayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={isPlaying ? 'Pause' : 'Auto-play'}>
              <IconButton size="small" onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <PauseIcon     sx={{ fontSize: 18 }} />
                  : <PlayArrowIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Previous step">
            <span>
              <IconButton size="small" onClick={prev} disabled={atStart} aria-label="Previous step">
                <SkipPreviousIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Progress + label */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ display: 'block', mb: 0.4, fontWeight: 500, fontSize: 12, color: 'text.primary',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stepLabel}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 3, borderRadius: 2,
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: accentColor },
              }}
            />
          </Box>

          <Typography sx={{ fontSize: 11, color: 'text.disabled', minWidth: 36, textAlign: 'right' }}>
            {step + 1}/{total}
          </Typography>

          <Tooltip title="Next step">
            <span>
              <IconButton size="small" onClick={next} disabled={atEnd} aria-label="Next step">
                <SkipNextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Speed selector */}
          <Tooltip title="Auto-play speed">
            <Select
              value={autoInterval}
              onChange={e => setAutoInterval(e.target.value)}
              size="small"
              variant="standard"
              disableUnderline
              aria-label="Speed"
              sx={{ fontSize: 11, color: 'text.disabled', minWidth: 34, '& .MuiSelect-select': { py: 0, px: 0.5 } }}
            >
              {SPEED_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
              ))}
            </Select>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}
