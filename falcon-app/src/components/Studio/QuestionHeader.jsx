import { Box, Typography, Chip } from '@mui/material'
import { useTheme } from '@mui/material'
import { intentMeta } from './constants'

export default function QuestionHeader({ prompt, intentType, frameCount }) {
  const theme = useTheme()
  const meta  = intentMeta(intentType)

  return (
    <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
      <Typography sx={{
        fontSize: 18, fontWeight: 700,
        color: theme.palette.text.primary,
        lineHeight: 1.4, mb: 1,
      }}>
        {prompt}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={`${meta.label} · ${frameCount ?? '?'} frame${frameCount !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            height: 22, fontSize: 11.5, fontWeight: 600,
            backgroundColor: meta.bg, color: meta.text,
          }}
        />
      </Box>
    </Box>
  )
}
