import { Box, Typography, CircularProgress } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useTheme } from '@mui/material'

const STAGES   = ['planning', 'generating', 'rendering']
const LABELS   = { planning: 'Planning frames…', generating: 'Generating visuals…', rendering: 'Rendering…' }
const SUBTEXTS = {
  planning:   'Deciding how to structure the lesson',
  generating: 'Creating visual content with AI',
  rendering:  'Compiling frames into the final output',
}

export default function LoadingView({ stage }) {
  const theme   = useTheme()
  const current = STAGES.indexOf(stage)

  return (
    <Box sx={{
      flex: 1,
      minHeight: 420,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 3,
    }}>
      {/* Spinner with icon centre */}
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress size={56} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AutoAwesomeIcon sx={{ fontSize: 22, color: theme.palette.primary.main }} />
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center', maxWidth: 320 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: theme.palette.text.primary, mb: 0.5 }}>
          {LABELS[stage]}
        </Typography>
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.6 }}>
          {SUBTEXTS[stage]}
        </Typography>
      </Box>

      {/* Stage progress dots */}
      <Box sx={{ display: 'flex', gap: 2.5 }}>
        {STAGES.map((s, i) => (
          <Box key={s} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: i <= current ? theme.palette.primary.main : theme.palette.divider,
              transition: 'all 0.3s',
              boxShadow: i === current ? `0 0 6px ${theme.palette.primary.main}66` : 'none',
            }} />
            <Typography sx={{
              fontSize: 10, fontWeight: i === current ? 700 : 400,
              color: i === current ? theme.palette.primary.main : theme.palette.text.secondary,
              opacity: i === current ? 1 : 0.45,
            }}>
              {s}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
