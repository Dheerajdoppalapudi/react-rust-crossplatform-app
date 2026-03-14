import { useState } from 'react'
import { Box, Typography, Collapse, IconButton, Tooltip, useTheme } from '@mui/material'
import NotesOutlinedIcon    from '@mui/icons-material/NotesOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp'
import ContentCopyIcon       from '@mui/icons-material/ContentCopy'
import CheckIcon             from '@mui/icons-material/Check'

// Parse the LLM's markdown bullet notes into an array of strings
function parseBullets(notes) {
  if (!notes) return []
  return notes
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export default function NotesPanel({ notes }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const [open,    setOpen]    = useState(false)
  const [copied,  setCopied]  = useState(false)

  if (!notes) return null

  const bullets = parseBullets(notes)
  if (bullets.length === 0) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(bullets.map((b) => `• ${b}`).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Box sx={{ px: 3, pb: 2 }}>
      {/* Toggle bar */}
      <Box
        onClick={() => setOpen((p) => !p)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1,
          borderRadius: open ? '10px 10px 0 0' : '10px',
          border: `1px solid ${theme.palette.divider}`,
          borderBottom: open ? 'none' : undefined,
          bgcolor: isDark ? '#1c1c1c' : '#f8fafc',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s',
          '&:hover': { bgcolor: isDark ? '#222' : '#f1f5f9' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotesOutlinedIcon sx={{ fontSize: 15, color: theme.palette.text.secondary }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: theme.palette.text.secondary }}>
            Lesson Notes
          </Typography>
          <Typography sx={{
            fontSize: 11, color: theme.palette.text.secondary, opacity: 0.5,
            fontWeight: 400,
          }}>
            {bullets.length} key points
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {open && (
            <Tooltip title={copied ? 'Copied!' : 'Copy notes'}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleCopy() }}
                sx={{ p: 0.4, color: theme.palette.text.secondary, opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                {copied
                  ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
                  : <ContentCopyIcon sx={{ fontSize: 13 }} />
                }
              </IconButton>
            </Tooltip>
          )}
          {open
            ? <KeyboardArrowUpIcon   sx={{ fontSize: 18, color: theme.palette.text.secondary, opacity: 0.5 }} />
            : <KeyboardArrowDownIcon sx={{ fontSize: 18, color: theme.palette.text.secondary, opacity: 0.5 }} />
          }
        </Box>
      </Box>

      {/* Collapsible content */}
      <Collapse in={open}>
        <Box sx={{
          px: 2.5, py: 2,
          border: `1px solid ${theme.palette.divider}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          bgcolor: isDark ? '#161616' : '#fff',
          display: 'flex', flexDirection: 'column', gap: 1.25,
        }}>
          {bullets.map((point, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0, mt: '7px',
                backgroundColor: theme.palette.primary.main, opacity: 0.6,
              }} />
              <Typography sx={{
                fontSize: 13, lineHeight: 1.65,
                color: theme.palette.text.secondary,
              }}>
                {point}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
