import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Tooltip, IconButton, Chip, useTheme } from '@mui/material'
import ContentCopyIcon  from '@mui/icons-material/ContentCopy'
import CheckIcon        from '@mui/icons-material/Check'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark }  from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import PlaybackBar from './PlaybackBar'
import { PALETTE } from '../../../theme/tokens'

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

export default function CodeWalkthrough({
  entityId,
  language = 'python',
  code     = '',
  steps    = [],
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [step,          setStep]          = useState(0)
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [autoInterval,  setAutoInterval]  = useState(3000)
  const [copied,        setCopied]        = useState(false)

  const total    = steps.length
  const currentStep   = steps[step] ?? steps[0]
  const highlightLine = currentStep?.line ?? null
  const explanation   = currentStep?.explanation ?? ''
  const stepLabel     = steps[step] ? `Step ${step + 1} of ${total}` : ''

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

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance() }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setIsPlaying(false); setStep(s => Math.max(0, s - 1)) }
  }, [advance])

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

  const surfaceBg = isDark ? PALETTE.darkSurface : PALETTE.warmSand

  const lineProps = (lineNumber) => {
    if (lineNumber === highlightLine) {
      return {
        style: {
          display: 'block',
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
          borderLeft: `3px solid ${isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.22)'}`,
          paddingLeft: '8px',
          marginLeft: '-8px',
        },
      }
    }
    return {}
  }

  return (
    <Box
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{
        borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
        outline: 'none',
        '&:focus-visible': { outline: `2px solid ${PALETTE.focusBlue}`, outlineOffset: 2 },
      }}
    >

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
          <Typography sx={{ fontSize: 11, color: 'text.secondary', opacity: 0.85 }}>
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
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55, fontSize: 13 }}>
            {explanation}
          </Typography>
        </Paper>
      )}

      {/* ── Step controls ── */}
      {total > 0 && (
        <PlaybackBar
          step={step}
          total={total}
          label={stepLabel}
          isPlaying={isPlaying}
          autoInterval={autoInterval}
          isDark={isDark}
          onPlayPause={() => setIsPlaying(p => !p)}
          onPrev={prev}
          onNext={next}
          onRestart={restart}
          onSpeedChange={setAutoInterval}
          sx={{
            px: 1.5, py: 1,
            borderTop: '1px solid', borderColor: 'divider',
            backgroundColor: surfaceBg,
          }}
        />
      )}
    </Box>
  )
}
