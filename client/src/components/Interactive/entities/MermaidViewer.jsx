import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Typography, Skeleton, IconButton, Tooltip, useTheme } from '@mui/material'
import { useExpanded } from '../BlockWrapper'
import ZoomInIcon       from '@mui/icons-material/ZoomIn'
import ZoomOutIcon      from '@mui/icons-material/ZoomOut'
import ZoomOutMapIcon   from '@mui/icons-material/ZoomOutMap'
import ContentCopyIcon  from '@mui/icons-material/ContentCopy'
import CheckIcon        from '@mui/icons-material/Check'
import mermaid from 'mermaid'

let _initializedTheme = null

function initMermaid(isDark) {
  const theme = isDark ? 'dark' : 'default'
  if (_initializedTheme === theme) return
  mermaid.initialize({
    startOnLoad: false, theme, securityLevel: 'loose',
    fontFamily: 'system-ui, sans-serif',
  })
  _initializedTheme = theme
}

let _idCounter = 0

function fixNewlines(src) {
  return src
    .replace(/"([^"]*)"/g,    (_, s) => `"${s.replace(/\\n/g, '<br/>')}"`)
    .replace(/\[([^\]]*)\]/g, (_, s) => `[${s.replace(/\\n/g, '<br/>')}]`)
}

const MIN_SCALE = 0.4
const MAX_SCALE = 3.0
const STEP      = 0.25

export default function MermaidViewer({ entityId, diagram, caption }) {
  const theme             = useTheme()
  const isDark            = theme.palette.mode === 'dark'
  const [svg, setSvg]       = useState(null)
  const [error, setError]   = useState(null)
  const [scale, setScale]   = useState(1)
  const [copied, setCopied] = useState(false)
  const isExpanded          = useExpanded()
  const idRef             = useRef(`mermaid-${entityId ?? ++_idCounter}`)

  useEffect(() => {
    if (!diagram) return
    initMermaid(isDark)
    setError(null)
    setSvg(null)
    setScale(1)

    mermaid.render(idRef.current, fixNewlines(diagram))
      .then(({ svg: rendered }) => {
        // Mermaid v11 may resolve with an error SVG instead of rejecting.
        // Detect by checking for known error markers in the returned string.
        if (!rendered || rendered.includes('Syntax error') || rendered.includes('Parse error') || rendered.includes('mermaid-error')) {
          setError('Could not render diagram — the generated syntax had errors.')
        } else {
          setSvg(rendered)
        }
      })
      .catch(err => {
        setError('Could not render diagram — the generated syntax had errors.')
      })
  }, [diagram, isDark])

  const zoomIn    = () => setScale(s => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)))
  const zoomOut   = () => setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)))
  const zoomReset = () => setScale(1)

  const handleCopy = useCallback(async () => {
    if (!diagram) return
    try {
      await navigator.clipboard.writeText(diagram)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [diagram])

  if (error) {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 2 }}>
        <Typography variant="caption" color="error">{error}</Typography>
      </Box>
    )
  }

  if (!svg) {
    return <Skeleton variant="rectangular" sx={{ width: '100%', height: 260, borderRadius: 2 }} animation="wave" />
  }

  return (
    <Box sx={{
      borderRadius: isExpanded ? 0 : 2,
      overflow: 'hidden',
      border: isExpanded ? 'none' : '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
    }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25,
        px: 1, py: 0.5,
        borderBottom: isExpanded ? 'none' : '1px solid', borderColor: 'divider',
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      }}>
        <Tooltip title="Zoom out">
          <span><IconButton size="small" onClick={zoomOut} disabled={scale <= MIN_SCALE}
            sx={{ color: 'text.secondary', width: 26, height: 26 }}>
            <ZoomOutIcon sx={{ fontSize: 15 }} />
          </IconButton></span>
        </Tooltip>
        <Typography sx={{ fontSize: 11, color: 'text.disabled', minWidth: 36, textAlign: 'center', userSelect: 'none' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <Tooltip title="Zoom in">
          <span><IconButton size="small" onClick={zoomIn} disabled={scale >= MAX_SCALE}
            sx={{ color: 'text.secondary', width: 26, height: 26 }}>
            <ZoomInIcon sx={{ fontSize: 15 }} />
          </IconButton></span>
        </Tooltip>
        <Tooltip title="Reset zoom">
          <span><IconButton size="small" onClick={zoomReset} disabled={scale === 1}
            sx={{ color: 'text.secondary', width: 26, height: 26 }}>
            <ZoomOutMapIcon sx={{ fontSize: 15 }} />
          </IconButton></span>
        </Tooltip>
        <Tooltip title={copied ? 'Copied!' : 'Copy diagram source'}>
          <IconButton size="small" onClick={handleCopy}
            sx={{ color: 'text.secondary', width: 26, height: 26 }}>
            {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Diagram with zoom */}
      <Box sx={{ overflow: 'auto', p: 2 }}>
        <Box
          dangerouslySetInnerHTML={{ __html: svg }}
          sx={{
            '& svg': {
              width: '100% !important',
              height: 'auto',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease',
              display: 'block',
            }
          }}
        />
      </Box>

      {caption && (
        <Typography variant="caption" sx={{ display: 'block', pb: 1.5, textAlign: 'center', color: 'text.secondary' }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
