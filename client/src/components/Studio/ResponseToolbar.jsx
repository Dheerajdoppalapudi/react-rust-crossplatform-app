import { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import {
  Box, IconButton, Tooltip, Typography, Menu, MenuItem,
  ListItemIcon, ListItemText, Divider, useTheme,
} from '@mui/material'
import ContentCopyIcon  from '@mui/icons-material/ContentCopy'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ArticleIcon      from '@mui/icons-material/Article'
import CheckIcon        from '@mui/icons-material/Check'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LanguageIcon     from '@mui/icons-material/Language'
import { downloadVisualPDF, downloadMarkdown } from '../../utils/pdfExport'

// ── Stacked favicon circles ───────────────────────────────────────────────────
function FaviconStack({ sources }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const top    = sources.slice(0, 3)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {top.map((s, i) => (
        <Box key={s.url ?? i} sx={{
          width: 15, height: 15, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          ml: i > 0 ? '-5px' : 0,
          border: `1.5px solid ${isDark ? '#1c1c1c' : '#fff'}`,
          bgcolor: isDark ? '#333' : '#e8e8e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {s.domain && (
            <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`}
              alt="" width={15} height={15} style={{ objectFit: 'contain' }} />
          )}
        </Box>
      ))}
    </Box>
  )
}

// ── Fallback clipboard copy ───────────────────────────────────────────────────
function legacyCopy(text) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;left:-9999px;top:0'
  document.body.appendChild(el)
  el.focus(); el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResponseToolbar({
  prompt,
  synthesisText,
  sources,
  contentRef,       // ref to the ResearchResult content div — used for PDF capture
  sourcesOpen,
  onToggleSources,
  disabled,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Copy state
  const [copyState, setCopyState] = useState('idle')   // 'idle' | 'done' | 'error'

  // Download menu
  const dlAnchorRef                   = useRef(null)
  const [dlMenuOpen, setDlMenuOpen]   = useState(false)
  const [dlState,    setDlState]      = useState('idle')  // 'idle' | 'busy' | 'error'

  // ── Copy ─────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const text = synthesisText || ''
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        legacyCopy(text)
      }
      setCopyState('done')
    } catch {
      try { legacyCopy(text); setCopyState('done') }
      catch { setCopyState('error') }
    } finally {
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handlePDF = async () => {
    setDlMenuOpen(false)
    if (!contentRef?.current) return
    setDlState('busy')
    try {
      await downloadVisualPDF({ element: contentRef.current, prompt, sources })
      setDlState('idle')
    } catch (err) {
      console.error('[PDF]', err)
      setDlState('error')
      setTimeout(() => setDlState('idle'), 3000)
    }
  }

  // ── Download Markdown ─────────────────────────────────────────────────────
  const handleMarkdown = () => {
    setDlMenuOpen(false)
    try {
      downloadMarkdown({ prompt, synthesisText, sources })
    } catch (err) {
      console.error('[MD]', err)
    }
  }

  // ── Shared icon button style ──────────────────────────────────────────────
  const iconBtn = {
    p: 0.7, borderRadius: '8px', color: theme.palette.text.secondary, transition: 'all 0.15s',
    '&:hover': { color: theme.palette.text.primary, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
  }

  const copyIcon = copyState === 'done'  ? <CheckIcon sx={{ fontSize: 15, color: 'success.main' }} />
    : copyState === 'error' ? <ErrorOutlineIcon sx={{ fontSize: 15, color: 'error.main' }} />
    : <ContentCopyIcon sx={{ fontSize: 15 }} />

  const dlIcon = dlState === 'error' ? <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
    : <FileDownloadIcon sx={{ fontSize: 16 }} />

  const dlTooltip = dlState === 'busy'  ? 'Generating…'
    : dlState === 'error' ? 'Export failed'
    : 'Download'

  const hasSources = sources.length > 0

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 1.5 }}>

      {/* ── Copy ── */}
      <Tooltip title={copyState === 'done' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy response'} placement="top" arrow>
        <span>
          <IconButton size="small" onClick={handleCopy} disabled={disabled} sx={iconBtn}>
            {copyIcon}
          </IconButton>
        </span>
      </Tooltip>

      {/* ── Download split button ── */}
      <Tooltip title={dlTooltip} placement="top" arrow>
        <span>
          <IconButton
            ref={dlAnchorRef}
            size="small"
            onClick={() => setDlMenuOpen(true)}
            disabled={disabled || dlState === 'busy'}
            sx={{ ...iconBtn, ...(dlState === 'error' ? { color: 'error.main' } : {}) }}
          >
            {dlIcon}
          </IconButton>
        </span>
      </Tooltip>

      {/* ── Download menu ── */}
      <Menu
        anchorEl={dlAnchorRef.current}
        open={dlMenuOpen}
        onClose={() => setDlMenuOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              mt: 0.5, minWidth: 180, borderRadius: '10px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              bgcolor: isDark ? '#1e1e1e' : '#fff',
            },
          },
        }}
      >
        <MenuItem onClick={handlePDF} sx={{ py: 1, px: 1.5, borderRadius: '7px', mx: 0.5, gap: 1 }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}>
            <PictureAsPdfIcon sx={{ fontSize: 16, color: isDark ? '#7b9fff' : '#1847d6' }} />
          </ListItemIcon>
          <ListItemText
            primary="Download as PDF"
            secondary="Captures charts &amp; tables"
            slotProps={{
              primary:   { sx: { fontSize: 13, fontWeight: 500 } },
              secondary: { sx: { fontSize: 11, mt: 0 } },
            }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5, mx: 1 }} />

        <MenuItem onClick={handleMarkdown} sx={{ py: 1, px: 1.5, borderRadius: '7px', mx: 0.5, gap: 1 }}>
          <ListItemIcon sx={{ minWidth: 'unset' }}>
            <ArticleIcon sx={{ fontSize: 16, color: isDark ? '#7b9fff' : '#1847d6' }} />
          </ListItemIcon>
          <ListItemText
            primary="Download as Markdown"
            secondary="Raw text + source links"
            slotProps={{
              primary:   { sx: { fontSize: 13, fontWeight: 500 } },
              secondary: { sx: { fontSize: 11, mt: 0 } },
            }}
          />
        </MenuItem>
      </Menu>

      {/* ── Sources badge ── */}
      {hasSources && (
        <Box
          component="button"
          type="button"
          onClick={onToggleSources}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.65,
            ml: 0.75, px: 1, py: 0.45, borderRadius: '8px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.palette.text.secondary, transition: 'all 0.15s',
            '&:hover': { color: theme.palette.text.primary, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          }}
        >
          <FaviconStack sources={sources} />
          <LanguageIcon sx={{ fontSize: 13, opacity: 0.65, ml: 0.25 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', lineHeight: 1 }}>
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </Typography>
          <Box component="span" sx={{
            display: 'inline-block', fontSize: 10, ml: 0.25, lineHeight: 1, opacity: 0.6,
            transform: sourcesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
          }}>
            ▾
          </Box>
        </Box>
      )}
    </Box>
  )
}

ResponseToolbar.propTypes = {
  prompt:          PropTypes.string.isRequired,
  synthesisText:   PropTypes.string,
  sources:         PropTypes.array,
  contentRef:      PropTypes.object,
  sourcesOpen:     PropTypes.bool,
  onToggleSources: PropTypes.func,
  disabled:        PropTypes.bool,
}

ResponseToolbar.defaultProps = {
  synthesisText:   '',
  sources:         [],
  contentRef:      null,
  sourcesOpen:     false,
  onToggleSources: () => {},
  disabled:        false,
}
