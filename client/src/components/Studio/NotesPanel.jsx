import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Collapse, IconButton, Tooltip, useTheme } from '@mui/material'
import ChevronRightIcon  from '@mui/icons-material/ChevronRight'
import ContentCopyIcon   from '@mui/icons-material/ContentCopy'
import CheckIcon         from '@mui/icons-material/Check'

function parseBullets(notes) {
  if (!notes) return []
  return notes
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export default function NotesPanel({ notes }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [open,   setOpen]   = useState(true)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  if (!notes) return null
  const bullets = parseBullets(notes)
  if (bullets.length === 0) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(bullets.map((b) => `• ${b}`).join('\n'))
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800)
  }

  const mutedText  = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const bodyText   = isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.8)'
  const bulletDot  = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)'

  return (
    <Box sx={{ pt: 2.5, pb: 1 }}>

      {/* ── Section header row ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: open ? 1.75 : 0 }}>

        {/* Left: toggle */}
        <Box
          onClick={() => setOpen((p) => !p)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', userSelect: 'none' }}
        >
          {/* Rotating chevron */}
          <ChevronRightIcon sx={{
            fontSize: 16,
            color: mutedText,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }} />

          <Typography sx={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: mutedText,
            lineHeight: 1,
          }}>
            Lesson Notes
          </Typography>

          {/* Count pill */}
          <Box sx={{
            px: 0.9, py: 0.15,
            borderRadius: '20px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            lineHeight: 1,
          }}>
            <Typography sx={{ fontSize: 10.5, color: mutedText, fontWeight: 500 }}>
              {bullets.length}
            </Typography>
          </Box>
        </Box>

        {/* Right: copy button — only when open */}
        {open && (
          <Tooltip title={copied ? 'Copied!' : 'Copy notes'} placement="left">
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                p: 0.5, color: mutedText,
                '&:hover': { color: bodyText, backgroundColor: 'transparent' },
                transition: 'color 0.15s',
              }}
            >
              {copied
                ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
                : <ContentCopyIcon sx={{ fontSize: 13 }} />
              }
            </IconButton>
          </Tooltip>
        )}

      </Box>

      {/* ── Collapsible body ───────────────────────────────────────────────── */}
      <Collapse in={open} unmountOnExit>
        <Box>
          {/* Bullet list */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {bullets.map((point, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', py: 0.55 }}
              >
                {/* Dot */}
                <Box sx={{
                  width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                  mt: '9px',
                  backgroundColor: bulletDot,
                }} />

                {/* Text */}
                <Typography sx={{
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  color: bodyText,
                  fontWeight: 400,
                }}>
                  {point}
                </Typography>
              </Box>
            ))}
          </Box>

        </Box>
      </Collapse>
    </Box>
  )
}
