import { Box, CircularProgress, useTheme } from '@mui/material'

/**
 * Shown while a lazy-loaded route chunk is downloading. Centered, theme-aware
 * spinner — replaces the blank flash from a `null` Suspense fallback.
 */
export default function RouteFallback() {
  const theme = useTheme()
  return (
    <Box
      sx={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress size={26} thickness={3} sx={{ color: theme.palette.text.disabled }} />
    </Box>
  )
}
