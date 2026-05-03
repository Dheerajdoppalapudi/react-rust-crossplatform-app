import { useState, useEffect, useCallback } from 'react'
import { Box, IconButton, Typography, LinearProgress, Tooltip, Select, MenuItem, useTheme } from '@mui/material'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import SkipNextIcon     from '@mui/icons-material/SkipNext'
import PlayArrowIcon    from '@mui/icons-material/PlayArrow'
import PauseIcon        from '@mui/icons-material/Pause'
import ReplayIcon       from '@mui/icons-material/Replay'
import { useSceneStore } from '../useSceneStore'

const SPEED_OPTIONS = [
  { label: '2s',  value: 2000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
]

export default function StepControls({
  entityId,
  steps          = [],
  targetEntityId,
  autoPlay       = false,
  interval       = 3000,
  loop           = false,
  showPlayButton = true,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const resolvedTarget = targetEntityId || entityId
  const step           = useSceneStore(s => s.getStep(resolvedTarget))
  const setStep        = useSceneStore(s => s.setStep)

  const total    = steps.length
  const atStart  = step === 0
  const atEnd    = step === total - 1
  const label    = steps[step] ?? `Step ${step + 1}`
  const progress = total > 1 ? (step / (total - 1)) * 100 : 100

  const [isPlaying,    setIsPlaying]    = useState(autoPlay)
  const [autoInterval, setAutoInterval] = useState(interval)

  const advance = useCallback(() => {
    setStep(resolvedTarget, (prev) => {
      if (prev >= total - 1) {
        if (loop) return 0
        setIsPlaying(false)
        return prev
      }
      return prev + 1
    })
  }, [resolvedTarget, setStep, total, loop])

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(advance, autoInterval)
    return () => clearInterval(id)
  }, [isPlaying, advance, autoInterval])

  // Global keyboard navigation — ← → and space
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIsPlaying(false)
        setStep(resolvedTarget, s => Math.max(0, s - 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, resolvedTarget, setStep])

  const prev    = () => { setIsPlaying(false); setStep(resolvedTarget, Math.max(0, step - 1)) }
  const next    = () => { setIsPlaying(false); setStep(resolvedTarget, Math.min(total - 1, step + 1)) }
  const restart = () => { setStep(resolvedTarget, 0); setIsPlaying(true) }

  const finished = atEnd && !loop && !isPlaying && step > 0

  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider', borderRadius: 2,
      p: 1.5, display: 'flex', alignItems: 'center', gap: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    }}>
      {showPlayButton && (
        finished ? (
          <Tooltip title="Restart">
            <IconButton size="small" onClick={restart} aria-label="Restart">
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton size="small" onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )
      )}

      <IconButton size="small" onClick={prev} disabled={atStart} aria-label="Previous step">
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

      <IconButton size="small" onClick={next} disabled={atEnd && !loop} aria-label="Next step">
        <SkipNextIcon fontSize="small" />
      </IconButton>

      {showPlayButton && (
        <Tooltip title="Auto-advance speed">
          <Select
            value={autoInterval}
            onChange={e => setAutoInterval(e.target.value)}
            size="small"
            variant="standard"
            disableUnderline
            aria-label="Auto-advance speed"
            sx={{
              fontSize: 11, color: 'text.disabled', minWidth: 34,
              '& .MuiSelect-select': { py: 0, px: 0.5 },
            }}
          >
            {SPEED_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
            ))}
          </Select>
        </Tooltip>
      )}
    </Box>
  )
}
