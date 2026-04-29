import { Box, IconButton, Typography, LinearProgress, useTheme } from '@mui/material'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import SkipNextIcon     from '@mui/icons-material/SkipNext'
import { useSceneStore } from '../useSceneStore'

export default function StepControls({ entityId, steps = [], targetEntityId }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const resolvedTarget = targetEntityId || entityId
  const step           = useSceneStore(s => s.getStep(resolvedTarget))
  const setStep        = useSceneStore(s => s.setStep)

  const total    = steps.length
  const label    = steps[step] ?? `Step ${step + 1}`
  const progress = total > 1 ? (step / (total - 1)) * 100 : 100

  const prev = () => setStep(resolvedTarget, Math.max(0, step - 1))
  const next = () => setStep(resolvedTarget, Math.min(total - 1, step + 1))

  return (
    <Box
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 2,
        p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <IconButton size="small" onClick={prev} disabled={step === 0} aria-label="Previous step">
        <SkipPreviousIcon fontSize="small" />
      </IconButton>

      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 500, color: 'text.primary', fontSize: 12.5 }}>
          {label}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3, borderRadius: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': { borderRadius: 2 },
          }}
        />
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 36, textAlign: 'right', fontSize: 11 }}>
        {step + 1}/{total}
      </Typography>

      <IconButton size="small" onClick={next} disabled={step === total - 1} aria-label="Next step">
        <SkipNextIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}
