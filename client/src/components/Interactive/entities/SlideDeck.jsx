import { useState, useCallback, useRef } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Dialog, Skeleton,
  CircularProgress, Button, Menu, MenuItem,
} from '@mui/material'
import FullscreenIcon        from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon    from '@mui/icons-material/FullscreenExit'
import DownloadIcon          from '@mui/icons-material/Download'
import VisibilityIcon        from '@mui/icons-material/Visibility'
import CodeIcon              from '@mui/icons-material/Code'
import EditIcon              from '@mui/icons-material/Edit'
import SlideshowIcon         from '@mui/icons-material/Slideshow'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RestartAltIcon        from '@mui/icons-material/RestartAlt'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'
import EntityCaption from './EntityCaption'
import { API_BASE } from '../../../constants/api'
import { neutralActive, neutralSubtle } from '../../../theme/styleUtils.js'
import { logger } from '../../../lib/logger.js'
import { useIsDark } from '../../../hooks/useIsDark.js'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Tab group ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'view', Icon: VisibilityIcon, label: 'View' },
  { id: 'code', Icon: CodeIcon,       label: 'Code' },
  { id: 'edit', Icon: EditIcon,       label: 'Edit' },
]

function TabGroup({ tab, onChange, isDark }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderRadius: '8px',
      padding: '2px',
      gap: '1px',
    }}>
      {TABS.map(({ id, Icon: TabIcon, label }) => {
        const active = tab === id
        return (
          <Box
            key={id}
            component="button"
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            aria-label={label}
            sx={{
              display: 'flex', alignItems: 'center', gap: '5px',
              px: '10px', py: '5px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: active ? 600 : 400,
              fontFamily: 'inherit',
              color: active
                ? (isDark ? '#fff' : PALETTE.nearBlackText)
                : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
              backgroundColor: active
                ? (neutralActive(isDark))
                : 'transparent',
              transition: 'all 0.15s',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              border: 'none',
              outline: 'none',
              '&:hover': {
                color: active
                  ? (isDark ? '#fff' : PALETTE.nearBlackText)
                  : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'),
                backgroundColor: active
                  ? (neutralActive(isDark))
                  : (neutralSubtle(isDark)),
              },
              '&:focus-visible': {
                outline: `2px solid ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}`,
                outlineOffset: 1,
              },
            }}
          >
            <TabIcon sx={{ fontSize: '13px' }} />
            <span>{label}</span>
          </Box>
        )
      })}
    </Box>
  )
}

// ── Download dropdown ─────────────────────────────────────────────────────────

function DownloadDropdown({ onHtml, onPptx, pptxLoading, iconOnly = false, isDark }) {
  const [anchor, setAnchor] = useState(null)

  const trigger = iconOnly ? (
    <Tooltip title="Download">
      <IconButton aria-label="Slide options"
        size="small"
        onClick={e => setAnchor(e.currentTarget)}
        sx={{
          width: 32, height: 32, borderRadius: '7px',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          '&:hover': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            color: isDark ? '#fff' : PALETTE.nearBlackText,
            borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
          },
        }}
      >
        <DownloadIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  ) : (
    <Button
      size="small"
      variant="outlined"
      endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '13px !important' }} />}
      onClick={e => setAnchor(e.currentTarget)}
      sx={{
        height: 30, px: 1.5,
        fontSize: 12, fontWeight: 500,
        color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        textTransform: 'none',
        minWidth: 0,
        '&:hover': {
          borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          backgroundColor: neutralSubtle(isDark),
          color: isDark ? '#fff' : PALETTE.nearBlackText,
        },
      }}
    >
      Download
    </Button>
  )

  return (
    <>
      {trigger}
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 0.75, minWidth: 190,
            backgroundColor: isDark ? PALETTE.darkSubsurface : PALETTE.ivory,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : PALETTE.border}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            borderRadius: '10px',
            overflow: 'hidden',
          },
        }}
      >
        <MenuItem
          onClick={() => { onHtml(); setAnchor(null) }}
          sx={{
            fontSize: 13, gap: 1.5, py: 1.2,
            color: isDark ? 'rgba(255,255,255,0.8)' : PALETTE.nearBlackText,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' },
          }}
        >
          <DownloadIcon sx={{ fontSize: 16, opacity: 0.55 }} />
          Download as HTML
        </MenuItem>
        <MenuItem
          onClick={() => { onPptx(); setAnchor(null) }}
          disabled={pptxLoading}
          sx={{
            fontSize: 13, gap: 1.5, py: 1.2,
            color: isDark ? 'rgba(255,255,255,0.8)' : PALETTE.nearBlackText,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' },
          }}
        >
          {pptxLoading
            ? <CircularProgress size={14} sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
            : <SlideshowIcon sx={{ fontSize: 16, opacity: 0.55 }} />}
          {pptxLoading ? 'Generating…' : 'Download as PPTX'}
        </MenuItem>
      </Menu>
    </>
  )
}

// ── Inline toolbar ────────────────────────────────────────────────────────────

function InlineToolbar({ onToggleFullscreen, onHtml, onPptx, pptxLoading, title, isDark }) {
  const toolbarBg     = isDark ? PALETTE.darkSurface     : PALETTE.warmSand
  const toolbarBorder = isDark ? 'rgba(255,255,255,0.08)' : PALETTE.border
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      px: 1.5, height: 44, flexShrink: 0,
      backgroundColor: toolbarBg,
      borderBottom: `1px solid ${toolbarBorder}`,
    }}>
      {/* Left: icon + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <SlideshowIcon sx={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', flexShrink: 0 }} />
        <Typography sx={{
          fontSize: 13, fontWeight: 500,
          color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </Typography>
      </Box>

      {/* Right: expand + download */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
        <Tooltip title="Fullscreen">
          <IconButton aria-label="Toggle fullscreen"
            size="small"
            onClick={onToggleFullscreen}
            sx={{
              width: 28, height: 28, borderRadius: '6px',
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
              },
            }}
          >
            <FullscreenIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <DownloadDropdown onHtml={onHtml} onPptx={onPptx} pptxLoading={pptxLoading} iconOnly={false} isDark={isDark} />
      </Box>
    </Box>
  )
}

// ── Fullscreen toolbar ────────────────────────────────────────────────────────

function FullscreenToolbar({ tab, onTabChange, onToggleFullscreen, onHtml, onPptx, pptxLoading, isDark }) {
  const toolbarBg     = isDark ? PALETTE.darkSurface     : PALETTE.warmSand
  const toolbarBorder = isDark ? 'rgba(255,255,255,0.07)' : PALETTE.border
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      px: 1.5, height: 48, flexShrink: 0,
      backgroundColor: toolbarBg,
      borderBottom: `1px solid ${toolbarBorder}`,
    }}>
      {/* Exit fullscreen - left */}
      <Tooltip title="Exit fullscreen">
        <IconButton aria-label="Toggle fullscreen"
          size="small"
          onClick={onToggleFullscreen}
          sx={{
            width: 32, height: 32, borderRadius: '7px',
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: isDark ? '#fff' : PALETTE.nearBlackText,
            },
          }}
        >
          <FullscreenExitIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {/* Tabs + download - right */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TabGroup tab={tab} onChange={onTabChange} isDark={isDark} />
        <DownloadDropdown onHtml={onHtml} onPptx={onPptx} pptxLoading={pptxLoading} iconOnly isDark={isDark} />
      </Box>
    </Box>
  )
}

// ── Slide iframe ──────────────────────────────────────────────────────────────

function SlideIframe({ html, height = '100%' }) {
  if (!html) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{ width: '100%', height: height === '100%' ? 540 : height }}
        animation="wave"
      />
    )
  }
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={html}
      style={{
        width: '100%', height,
        border: 'none', display: 'block',
        // Slide HTML controls its own background; this is just a load-time fallback
        backgroundColor: '#07071a',
        overflow: 'hidden',
      }}
      scrolling="no"
      title="slide-presentation"
    />
  )
}

// ── Code / Edit pane ──────────────────────────────────────────────────────────

function CodePane({ value, editable, onChange, onReset, originalHtml, isDark }) {
  const isDirty   = editable && value !== originalHtml
  const paneBg    = isDark ? PALETTE.sidebarDark : PALETTE.parchment
  const paneBorder= isDark ? 'rgba(255,255,255,0.06)' : PALETTE.border
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {editable && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 0.6, flexShrink: 0,
          backgroundColor: paneBg,
          borderBottom: `1px solid ${paneBorder}`,
        }}>
          <Typography sx={{ fontSize: 11, color: isDirty ? 'rgba(251,189,35,0.7)' : (isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)') }}>
            {isDirty ? '● unsaved — switch to View to preview' : 'Edit HTML · switch to View to preview changes'}
          </Typography>
          {isDirty && (
            <Tooltip title="Reset to original">
              <IconButton aria-label="Restart" size="small" onClick={onReset}
                sx={{ width: 24, height: 24, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', '&:hover': { color: isDark ? '#fff' : PALETTE.nearBlackText } }}>
                <RestartAltIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
      <Box
        component="textarea"
        readOnly={!editable}
        value={value}
        onChange={editable ? e => onChange(e.target.value) : undefined}
        spellCheck={false}
        sx={{
          flex: 1, width: '100%', resize: 'none',
          border: 'none', outline: 'none',
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: 12, lineHeight: 1.75,
          backgroundColor: paneBg,
          color: isDark ? 'rgba(255,255,255,0.72)' : PALETTE.nearBlackText,
          p: 2,
          '&::selection': { backgroundColor: 'rgba(99,102,241,0.4)' },
        }}
      />
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SlideDeck({ entityId, html, title, spec, caption }) {
  const isDark = useIsDark()

  const [tab,         setTab]         = useState('view')
  const [editedHtml,  setEditedHtml]  = useState(html || '')
  const [fullscreen,  setFullscreen]  = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)
  const pptxAbortRef = useRef(null)

  const presentationTitle = title
    || (spec ? spec.split('\n')[0].replace(/^Title:\s*/i, '').replace(/['"]/g, '').trim() : 'Presentation')

  const activeHtml = editedHtml || html

  const handleDownloadHtml = useCallback(() => {
    const src = activeHtml
    if (!src) return
    const blob = new Blob([src], { type: 'text/html;charset=utf-8' })
    downloadBlob(blob, `${presentationTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50) || 'presentation'}.html`)
  }, [activeHtml, presentationTitle])

  const handleDownloadPptx = useCallback(async () => {
    const src = activeHtml
    if (!src || pptxLoading) return
    setPptxLoading(true)
    const ctrl = new AbortController()
    pptxAbortRef.current = ctrl
    try {
      const res = await fetch(`${API_BASE}/api/v1/export/pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: src, title: presentationTitle }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const blob = await res.blob()
      downloadBlob(blob, `${presentationTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50) || 'presentation'}.pptx`)
    } catch (err) {
      if (err.name !== 'AbortError') logger.error('pptx_export_failed', err)
    } finally {
      setPptxLoading(false)
      pptxAbortRef.current = null
    }
  }, [activeHtml, presentationTitle, pptxLoading])

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.border
  const cardBg      = isDark ? PALETTE.darkSurface : PALETTE.ivory
  const dlProps     = { onHtml: handleDownloadHtml, onPptx: handleDownloadPptx, pptxLoading, isDark }

  return (
    <Box>
      {/* ── Inline card ── */}
      <Box sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        backgroundColor: cardBg,
        boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.55)' : '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <InlineToolbar {...dlProps} title={presentationTitle} onToggleFullscreen={() => setFullscreen(true)} />
        <Box sx={{ height: 540, overflow: 'hidden' }}>
          <SlideIframe html={html} height={540} />
        </Box>
      </Box>

      <EntityCaption caption={caption} />

      {/* ── Fullscreen dialog ── */}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        fullScreen
        PaperProps={{
          sx: {
            backgroundColor: cardBg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <FullscreenToolbar
          {...dlProps}
          tab={tab}
          onTabChange={setTab}
          onToggleFullscreen={() => setFullscreen(false)}
        />
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'view' && <SlideIframe html={activeHtml} height="100%" />}
          {(tab === 'code' || tab === 'edit') && (
            <CodePane
              value={editedHtml}
              editable={tab === 'edit'}
              onChange={setEditedHtml}
              onReset={() => setEditedHtml(html || '')}
              originalHtml={html}
              isDark={isDark}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  )
}
