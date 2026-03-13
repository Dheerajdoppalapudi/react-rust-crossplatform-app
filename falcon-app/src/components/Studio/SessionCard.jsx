import { Box, Typography, Chip } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { useTheme } from '@mui/material'
import { ACCENT_BY_INTENT, intentMeta, relativeTime } from './constants'

export default function SessionCard({ session, isSelected, onClick }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const meta   = intentMeta(session.intent_type)
  const accent = ACCENT_BY_INTENT[session.intent_type] || '#e2e8f0'

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5, mb: 0.5, borderRadius: '10px', cursor: 'pointer', border: '1px solid',
        borderColor: isSelected ? theme.palette.primary.main + '55' : 'transparent',
        backgroundColor: isSelected
          ? isDark ? 'rgba(79,110,255,0.1)' : 'rgba(0,26,255,0.05)'
          : 'transparent',
        '&:hover': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: theme.palette.divider,
        },
        transition: 'all 0.15s',
      }}
    >
      {/* Mini frame preview bars */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        {Array.from({ length: Math.min(session.frame_count || 2, 3) }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1, height: 26, borderRadius: '5px',
              backgroundColor: isDark ? accent + '55' : accent,
              opacity: 0.5 + i * 0.2,
            }}
          />
        ))}
      </Box>

      <Typography sx={{
        fontSize: 12.5, fontWeight: 500, color: theme.palette.text.primary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.75,
      }}>
        {session.prompt}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip
          label={meta.label}
          size="small"
          sx={{
            height: 18, fontSize: 10, fontWeight: 600,
            backgroundColor: meta.bg, color: meta.text,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AccessTimeIcon sx={{ fontSize: 10, color: theme.palette.text.secondary, opacity: 0.5 }} />
          <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.5 }}>
            {relativeTime(session.created_at)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
