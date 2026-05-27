import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import { useTheme } from '@mui/material'

/**
 * Floating mini-toolbar that appears when the user selects text inside the
 * conversation thread. Shows Copy + Ask Follow-up buttons above the selection.
 *
 * Props:
 *   containerRef — ref to the scrollable container element the popup is scoped to
 *   onAskFollowUp(text) — called when the user clicks "Ask follow-up"
 */
export default function TextSelectionPopup({ containerRef, onAskFollowUp }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [popup, setPopup]     = useState(null)  // { x, y, text } or null
  const [copied, setCopied]   = useState(false)
  const popupRef              = useRef(null)
  const hideTimer             = useRef(null)

  const hide = useCallback(() => {
    setPopup(null)
    setCopied(false)
  }, [])

  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    function handleMouseUp(e) {
      // Don't trigger from clicks inside the popup itself
      if (popupRef.current?.contains(e.target)) return

      clearTimeout(hideTimer.current)
      // Small delay so the browser has time to finalize the selection
      hideTimer.current = setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim()

        if (!text || text.length < 3) {
          hide()
          return
        }

        // Only show if the selection is inside our container
        if (!sel.rangeCount) { hide(); return }
        const range = sel.getRangeAt(0)
        if (!container.contains(range.commonAncestorContainer)) { hide(); return }

        const rect = range.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        // Position relative to the container's top-left
        const x = rect.left - containerRect.left + rect.width / 2
        const y = rect.top  - containerRect.top + container.scrollTop - 8

        setPopup({ x, y, text })
        setCopied(false)
      }, 80)
    }

    function handleMouseDown(e) {
      if (popupRef.current?.contains(e.target)) return
      hide()
    }

    container.addEventListener('mouseup',   handleMouseUp)
    container.addEventListener('mousedown', handleMouseDown)
    return () => {
      container.removeEventListener('mouseup',   handleMouseUp)
      container.removeEventListener('mousedown', handleMouseDown)
      clearTimeout(hideTimer.current)
    }
  }, [containerRef, hide])

  if (!popup) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(popup.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback: execCommand
      document.execCommand('copy')
    }
  }

  const handleAsk = () => {
    onAskFollowUp(popup.text)
    window.getSelection()?.removeAllRanges()
    hide()
  }

  return (
    <Box
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        position:    'absolute',
        left:        popup.x,
        top:         popup.y,
        transform:   'translate(-50%, -100%)',
        zIndex:      1400,
        display:     'flex',
        alignItems:  'center',
        gap:         0.25,
        px:          0.75,
        py:          0.5,
        borderRadius: '10px',
        bgcolor:     isDark ? '#1e1e2e' : '#ffffff',
        border:      `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
        boxShadow:   isDark
          ? '0 4px 20px rgba(0,0,0,0.6)'
          : '0 4px 20px rgba(0,0,0,0.14)',
        pointerEvents: 'auto',
        userSelect:  'none',
      }}
    >
      {/* Copy button */}
      <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{
            p: 0.6, borderRadius: '7px',
            color: copied
              ? (isDark ? '#4ade80' : '#16a34a')
              : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'),
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color:   isDark ? '#fff' : '#000',
            },
            transition: 'color 0.15s',
          }}
        >
          <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ width: 1, height: 18, bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />

      {/* Ask follow-up button */}
      <Box
        component="button"
        onClick={handleAsk}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.6,
          px: 1, py: 0.5, border: 'none', background: 'none',
          cursor: 'pointer', borderRadius: '7px', fontFamily: 'inherit',
          color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.62)',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color:   isDark ? '#fff' : '#000',
          },
          transition: 'all 0.15s',
        }}
      >
        <FormatQuoteRoundedIcon sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>
          Ask follow-up
        </Typography>
      </Box>
    </Box>
  )
}
