import { Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY } from '../../../theme/tokens'

export default function EntityCaption({ caption }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  if (!caption) return null
  return (
    <Typography sx={{
      mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
      color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
    }}>
      {caption}
    </Typography>
  )
}
