import { Typography } from '@mui/material'
import { TYPOGRAPHY } from '../../../theme/tokens'
import { useIsDark } from '../../../hooks/useIsDark.js'

export default function EntityCaption({ caption }) {
  const isDark = useIsDark()
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
