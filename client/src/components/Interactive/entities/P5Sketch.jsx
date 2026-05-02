import { Box, Typography, Skeleton, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

export default function P5Sketch({
  html,
  height  = 420,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box>
      <Box sx={{
        position: 'relative',
        height,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
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
            component="iframe"
            sandbox="allow-scripts"
            srcDoc={html}
            title="p5-sketch"
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
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
