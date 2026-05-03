import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { Box, IconButton, Tooltip, Dialog, DialogContent, useTheme } from '@mui/material'
import OpenInFullIcon  from '@mui/icons-material/OpenInFull'
import CloseIcon       from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon       from '@mui/icons-material/Check'

// Entities can read this to suppress their outer border/padding when rendered in the expand modal
export const ExpandedContext = createContext(false)
export function useExpanded() { return useContext(ExpandedContext) }

export default function BlockWrapper({ children, copyText, label, noExpand = false }) {
  const [hovered,  setHovered]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied,   setCopied]   = useState(false)
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const handleCopy = useCallback(async () => {
    if (!copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [copyText])

  useEffect(() => {
    if (!expanded) return
    const handler = (e) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const hasTools = !noExpand || !!copyText

  const toolbar = hasTools ? (
    <Box sx={{
      position: 'absolute', top: 6, right: 6, zIndex: 10,
      display: 'flex', gap: 0.25,
      opacity: hovered ? 1 : 0,
      pointerEvents: hovered ? 'auto' : 'none',
      transition: 'opacity 0.15s ease',
      backgroundColor: isDark ? 'rgba(13,17,23,0.88)' : 'rgba(255,255,255,0.92)',
      borderRadius: '6px',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      px: 0.25, py: 0.25,
    }}>
      {copyText && (
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={handleCopy} aria-label="Copy content"
            sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', width: 26, height: 26 }}>
            {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      )}
      {!noExpand && (
        <Tooltip title="Expand">
          <IconButton size="small" onClick={() => setExpanded(true)} aria-label="Expand"
            sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', width: 26, height: 26 }}>
            <OpenInFullIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : null

  return (
    <>
      <ExpandedContext.Provider value={false}>
        <Box
          role="region"
          aria-label={label}
          sx={{ position: 'relative' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {!expanded && toolbar}
          {!expanded && children}
        </Box>
      </ExpandedContext.Provider>

      {!noExpand && (
        <Dialog
          open={expanded}
          onClose={() => setExpanded(false)}
          maxWidth={false}
          PaperProps={{
            sx: {
              width: '90vw',
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 3,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }
          }}
        >
          <Box sx={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            px: 1.5, py: 0.75, flexShrink: 0,
            borderBottom: '1px solid', borderColor: 'divider',
          }}>
            {copyText && (
              <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                <IconButton size="small" onClick={handleCopy} aria-label="Copy content"
                  sx={{ mr: 0.5, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>
                  {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Close (Esc)">
              <IconButton size="small" onClick={() => setExpanded(false)} aria-label="Close expanded view"
                sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* ExpandedContext: true — entities read this to strip their outer border/container */}
          <ExpandedContext.Provider value={true}>
            <DialogContent sx={{ flex: 1, overflowY: 'auto', p: 0, '&.MuiDialogContent-root': { p: 0 } }}>
              {expanded && children}
            </DialogContent>
          </ExpandedContext.Provider>
        </Dialog>
      )}
    </>
  )
}
