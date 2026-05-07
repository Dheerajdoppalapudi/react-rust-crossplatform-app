import { Box, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useTheme } from '@mui/material'
import { BRAND } from '../../theme/tokens.js'
import SuggestionBoxes from './SuggestionBoxes'

export default function EmptyView({ onSuggestionClick }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{
      flex: 1,
      minHeight: 420,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 3, px: 3,
    }}>
      {/* Icon badge */}
      <Box sx={{
        width: 64, height: 64,
        background: isDark
          ? 'linear-gradient(135deg, rgba(75,114,255,0.15) 0%, rgba(75,114,255,0.08) 100%)'
          : `linear-gradient(135deg, ${BRAND.primary}0d 0%, ${BRAND.primary}18 100%)`,
        borderRadius: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${isDark ? 'rgba(75,114,255,0.2)' : `${BRAND.primary}28`}`,
      }}>
        <AutoAwesomeIcon sx={{ fontSize: 28, color: theme.palette.primary.main, opacity: 0.85 }} />
      </Box>

      <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 18, color: theme.palette.text.primary, mb: 0.75 }}>
          What do you want to learn?
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.65 }}>
          Type a topic and Zenith will generate a visual lesson — or pick one below to start with deep research.
        </Typography>
      </Box>

      <SuggestionBoxes onSuggestionClick={onSuggestionClick} />
    </Box>
  )
}
