import { useState, useCallback, useRef } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Dialog, Skeleton,
  LinearProgress, CircularProgress, useTheme,
} from '@mui/material'
import FullscreenIcon      from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon  from '@mui/icons-material/FullscreenExit'
import DownloadIcon        from '@mui/icons-material/Download'
import PictureAsPdfIcon    from '@mui/icons-material/PictureAsPdf'
import SlideshowIcon       from '@mui/icons-material/Slideshow'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'
import { API_BASE } from '../../../constants/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Iframe wrapper ────────────────────────────────────────────────────────────

function SlideIframe({ html, height = 560, fullscreen = false }) {
  if (!html) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{ width: '100%', height, borderRadius: 0 }}
        animation="wave"
      />
    )
  }
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={html}
      style={{
        width: '100%',
        height: fullscreen ? '100%' : height,
        border: 'none',
        display: 'block',
        backgroundColor: '#07071a',
      }}
      title="slide-presentation"
    />
  )
}

// ── Control bar ───────────────────────────────────────────────────────────────

function ControlBar({ onDownloadHtml, onDownloadPptx, onFullscreen, isFullscreen, pptxLoading, isDark }) {
  const btnSx = {
    width: 30, height: 30,
    color: isFullscreen ? 'rgba(255,255,255,0.65)' : 'text.secondary',
    '&:hover': { color: isFullscreen ? '#fff' : 'text.primary' },
  }
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: 0.5, px: 1.5, py: 0.75,
      backgroundColor: isFullscreen
        ? 'rgba(0,0,0,0.55)'
        : (isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'),
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Tooltip title="Download HTML">
        <IconButton size="small" onClick={onDownloadHtml} sx={btnSx}>
          <DownloadIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Download PPTX">
        <IconButton size="small" onClick={onDownloadPptx} disabled={pptxLoading} sx={btnSx}>
          {pptxLoading
            ? <CircularProgress size={13} sx={{ color: 'inherit' }} />
            : <PictureAsPdfIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>

      <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        <IconButton size="small" onClick={onFullscreen} sx={btnSx}>
          {isFullscreen
            ? <FullscreenExitIcon sx={{ fontSize: 16 }} />
            : <FullscreenIcon     sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SlideDeck({ entityId, html, title, spec, caption }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'

  const [fullscreen,   setFullscreen]   = useState(false)
  const [pptxLoading,  setPptxLoading]  = useState(false)
  const pptxAbortRef = useRef(null)

  const presentationTitle = title || (spec ? spec.split('\n')[0].replace(/^Title:\s*/i, '').replace(/['"]/g, '').trim() : 'Presentation')

  const handleDownloadHtml = useCallback(() => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const safe = presentationTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50)
    downloadBlob(blob, `${safe || 'presentation'}.html`)
  }, [html, presentationTitle])

  const handleDownloadPptx = useCallback(async () => {
    if (!html || pptxLoading) return
    setPptxLoading(true)
    const ctrl = new AbortController()
    pptxAbortRef.current = ctrl
    try {
      const res = await fetch(`${API_BASE}/api/export/pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, title: presentationTitle }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const blob = await res.blob()
      const safe = presentationTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50)
      downloadBlob(blob, `${safe || 'presentation'}.pptx`)
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[SlideDeck] PPTX export failed', err)
    } finally {
      setPptxLoading(false)
      pptxAbortRef.current = null
    }
  }, [html, presentationTitle, pptxLoading])

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream

  return (
    <Box>
      {/* ── Inline card ── */}
      <Box sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        backgroundColor: '#07071a',
        boxShadow: isDark
          ? '0 8px 40px rgba(0,0,0,0.6)'
          : '0 4px 24px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1.5,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <SlideshowIcon sx={{ fontSize: 15, color: BRAND.primary, opacity: 0.8 }} />
          <Typography sx={{
            fontSize: 12, fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {presentationTitle}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
            PRESENTATION
          </Typography>
        </Box>

        {/* Slide iframe */}
        <SlideIframe html={html} height={540} />

        {/* Control bar */}
        <ControlBar
          onDownloadHtml={handleDownloadHtml}
          onDownloadPptx={handleDownloadPptx}
          onFullscreen={() => setFullscreen(true)}
          isFullscreen={false}
          pptxLoading={pptxLoading}
          isDark={isDark}
        />
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}

      {/* ── Fullscreen dialog ── */}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        fullScreen
        PaperProps={{
          sx: {
            backgroundColor: '#07071a',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Dialog header strip */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <SlideshowIcon sx={{ fontSize: 14, color: BRAND.primary, opacity: 0.7 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', flex: 1 }}>
            {presentationTitle}
          </Typography>
        </Box>

        {/* Fullscreen iframe — takes remaining height */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <SlideIframe html={html} fullscreen />
        </Box>

        {/* Dialog control bar */}
        <ControlBar
          onDownloadHtml={handleDownloadHtml}
          onDownloadPptx={handleDownloadPptx}
          onFullscreen={() => setFullscreen(false)}
          isFullscreen={true}
          pptxLoading={pptxLoading}
          isDark={true}
        />
      </Dialog>
    </Box>
  )
}
