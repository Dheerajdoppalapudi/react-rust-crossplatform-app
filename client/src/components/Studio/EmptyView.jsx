import { Box, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useTheme } from '@mui/material'
import { INITIAL_SUGGESTIONS } from './constants'
import { BRAND, PALETTE } from '../../theme/tokens.js'

export default function EmptyView({ onSuggestionClick }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{
      flex: 1,
      minHeight: 420,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2.5, px: 3,
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
          Type a topic and Zenith will generate a visual lesson — animations, diagrams, or illustrations.
        </Typography>
      </Box>

      {/* Quick suggestions */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 500, mt: 0.5 }}>
        {INITIAL_SUGGESTIONS.map((s) => (
          <Box
            key={s}
            component="button"
            type="button"
            onClick={() => onSuggestionClick(s)}
            sx={{
              px: 1.75, py: 0.75, borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              cursor: 'pointer', fontSize: 12.5, color: theme.palette.text.secondary,
              fontFamily: 'inherit',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                backgroundColor: isDark ? 'rgba(75,114,255,0.08)' : `${BRAND.primary}08`,
              },
              transition: 'all 0.15s',
            }}
          >
            {s}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
