import { useState, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, Skeleton, useTheme, Dialog, DialogContent } from '@mui/material'
import RefreshIcon      from '@mui/icons-material/Refresh'
import OpenInFullIcon   from '@mui/icons-material/OpenInFull'
import CloseIcon        from '@mui/icons-material/Close'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

export default function P5Sketch({
  html,
  height  = 420,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [reloadKey,  setReloadKey]  = useState(0)
  const [expanded,   setExpanded]   = useState(false)
  const [expandKey,  setExpandKey]  = useState(0)

  const handleReload  = useCallback(() => setReloadKey(k => k + 1), [])
  const handleExpand  = useCallback(() => { setExpandKey(k => k + 1); setExpanded(true) }, [])
  const handleCollapse= useCallback(() => setExpanded(false), [])

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mb: 0.5 }}>
        <Tooltip title="Reload sketch">
          <span>
            <IconButton size="small" onClick={handleReload} disabled={!html} aria-label="Reload sketch"
              sx={{ color: 'text.disabled', width: 26, height: 26 }}>
              <RefreshIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Expand">
          <span>
            <IconButton size="small" onClick={handleExpand} disabled={!html} aria-label="Expand sketch"
              sx={{ color: 'text.disabled', width: 26, height: 26 }}>
              <OpenInFullIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Inline view */}
      <Box sx={{
        position: 'relative', height,
        borderRadius: `${RADIUS.lg}px`, overflow: 'hidden',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
      }}>
        {!html ? (
          <Skeleton
            variant="rectangular"
            sx={{ position: 'absolute', inset: 0, transform: 'none', zIndex: 1 }}
            animation="wave"
          />
        ) : (
          <Box
            key={reloadKey}
            component="iframe"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={html}
            title="p5-sketch"
            sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        )}
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}

      {/* Expanded Dialog */}
      <Dialog
        open={expanded}
        onClose={handleCollapse}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '90vw', height: '85vh',
            maxWidth: 'none', maxHeight: 'none',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          },
        }}
      >
        <Box sx={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          px: 1.5, py: 0.75,
          borderBottom: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
          gap: 0.5,
        }}>
          <Tooltip title="Reload">
            <IconButton size="small" onClick={() => setExpandKey(k => k + 1)}
              sx={{ color: 'text.secondary', width: 28, height: 28 }}>
              <RefreshIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton size="small" onClick={handleCollapse}
              sx={{ color: 'text.secondary', width: 28, height: 28 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <DialogContent sx={{ flex: 1, p: 0, overflow: 'hidden' }}>
          <Box
            key={expandKey}
            component="iframe"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={html}
            title="p5-sketch-expanded"
            sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  )
}
