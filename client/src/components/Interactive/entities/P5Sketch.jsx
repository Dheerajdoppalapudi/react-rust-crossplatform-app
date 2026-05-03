import { useState, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, Skeleton, useTheme } from '@mui/material'
import RefreshIcon   from '@mui/icons-material/Refresh'
import HeightIcon    from '@mui/icons-material/Height'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

export default function P5Sketch({
  html,
  height  = 420,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [tall,      setTall]      = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const handleReload = useCallback(() => setReloadKey(k => k + 1), [])
  const handleTall   = useCallback(() => setTall(t => !t), [])

  const effectiveHeight = tall ? height * 2 : height

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', justifyContent: 'flex-end', gap: 0.25,
        mb: 0.5,
      }}>
        <Tooltip title={tall ? 'Restore height' : 'Double height'}>
          <IconButton size="small" onClick={handleTall} aria-label={tall ? 'Restore height' : 'Double height'}
            sx={{
              color: tall ? '#4B72FF' : 'text.disabled', width: 26, height: 26,
              border: tall ? '1px solid #4B72FF33' : '1px solid transparent',
            }}>
            <HeightIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reload sketch">
          <span>
            <IconButton size="small" onClick={handleReload} disabled={!html} aria-label="Reload sketch"
              sx={{ color: 'text.disabled', width: 26, height: 26 }}>
              <RefreshIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{
        position: 'relative',
        height: effectiveHeight,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        transition: 'height 0.3s ease',
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
            sandbox="allow-scripts"
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
    </Box>
  )
}
