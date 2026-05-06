import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Collapse, IconButton, Tooltip, useTheme } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ContentCopyIcon  from '@mui/icons-material/ContentCopy'
import CheckIcon        from '@mui/icons-material/Check'
import MarkdownText     from '../Interactive/MarkdownText'

function toBullets(notes) {
  // Split on newlines, strip any existing bullet chars, re-emit as markdown list
  const lines = notes
    .split('\n')
    .map(l => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)

  // Already a single block of prose (no newlines) — split on sentences.
  // Require the next char to be uppercase so "Dr. Smith" and "U.S.A." don't split.
  if (lines.length === 1) {
    return lines[0]
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => `- ${s}`)
      .join('\n')
  }

  return lines.map(l => `- ${l}`).join('\n')
}

export default function NotesPanel({ notes }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [open,   setOpen]   = useState(true)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  if (!notes?.trim()) return null

  const bulletNotes = toBullets(notes)

  const handleCopy = () => {
    navigator.clipboard.writeText(bulletNotes)
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800)
  }

  const mutedText = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const bodyText  = isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.8)'

  return (
    <Box sx={{ pt: 2.5, pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: open ? 1.75 : 0 }}>
        <Box onClick={() => setOpen((p) => !p)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', userSelect: 'none' }}>
          <ChevronRightIcon sx={{
            fontSize: 16, color: mutedText, transition: 'transform 0.2s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: mutedText, lineHeight: 1 }}>
            Lesson Notes
          </Typography>
        </Box>

        {open && (
          <Tooltip title={copied ? 'Copied!' : 'Copy notes'} placement="left">
            <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5, color: mutedText, '&:hover': { color: bodyText, backgroundColor: 'transparent' }, transition: 'color 0.15s' }}>
              {copied ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <MarkdownText content={bulletNotes} sx={{ color: bodyText }} />
      </Collapse>
    </Box>
  )
}
