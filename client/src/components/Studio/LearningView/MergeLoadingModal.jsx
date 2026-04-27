import { useEffect, useState } from 'react'
import { Dialog, Box, Typography, LinearProgress, useTheme } from '@mui/material'
import MergeTypeIcon from '@mui/icons-material/MergeType'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { pulse } from '../../../theme/animations'

const STEPS = [
  { key: 'tree',    label: 'Reading session tree',       duration: 800  },
  { key: 'order',   label: 'Ordering sessions',           duration: 600  },
  { key: 'concat',  label: 'Concatenating videos',        duration: 2400 },
  { key: 'saving',  label: 'Saving merged video',         duration: 500  },
  { key: 'done',    label: 'Ready to play',               duration: 0    },
]

const VISIBLE_STEPS = STEPS.filter((s) => s.key !== 'done')

export default function MergeLoadingModal({ open, sessionCount = 0 }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [stepIndex, setStepIndex] = useState(0)
  const [progress,  setProgress]  = useState(0)

  // Reset when opened
  useEffect(() => {
    if (!open) return
    setStepIndex(0)
    setProgress(0)
  }, [open])

  // Advance through steps while open
  useEffect(() => {
    if (!open) return
    const step = STEPS[stepIndex]
    if (!step || step.duration === 0) return

    // Smooth progress bar within step
    const tick = 60
    const totalTicks = step.duration / tick
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed++
      setProgress((elapsed / totalTicks) * 100)
      if (elapsed >= totalTicks) {
        clearInterval(interval)
        setProgress(0)
        setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
      }
    }, tick)

    return () => clearInterval(interval)
  }, [open, stepIndex])

  const currentStep = STEPS[stepIndex] || STEPS[STEPS.length - 1]

  return (
    <Dialog
      open={open}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 420,
          borderRadius: '14px',
          bgcolor: isDark ? '#141414' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }
      }}
    >
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        display: 'flex', alignItems: 'center', gap: 1.5,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'}`,
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '10px',
          bgcolor: `${theme.palette.primary.main}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <MergeTypeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>
            Merging Videos
          </Typography>
          <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, mt: 0.25 }}>
            {sessionCount > 0 ? `Combining ${sessionCount} session${sessionCount > 1 ? 's' : ''} in sequence` : 'Combining sessions in sequence'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {VISIBLE_STEPS.map((step, i) => {
          const isDone    = i < stepIndex
          const isActive  = i === stepIndex
          const isPending = i > stepIndex

          return (
            <Box key={step.key} sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <Box sx={{ mt: 0.25 }}>
                  {isDone ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                  ) : isActive ? (
                    <Box sx={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${theme.palette.primary.main}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Box sx={{
                        width: 7, height: 7, borderRadius: '50%',
                        bgcolor: theme.palette.primary.main,
                        animation: `${pulse} 1s ease-in-out infinite`,
                      }} />
                    </Box>
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db' }} />
                  )}
                </Box>
                {i < VISIBLE_STEPS.length - 1 && (
                  <Box sx={{
                    width: 2, flex: 1, minHeight: 20, my: 0.5,
                    bgcolor: isDone ? theme.palette.primary.main : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                    borderRadius: 1,
                    transition: 'background-color 0.4s ease',
                  }} />
                )}
              </Box>

              <Box sx={{ pb: i < VISIBLE_STEPS.length - 1 ? 1.5 : 0, flex: 1 }}>
                <Typography sx={{
                  fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                  color: isDone
                    ? theme.palette.primary.main
                    : isActive
                    ? theme.palette.text.primary
                    : theme.palette.text.disabled,
                  transition: 'color 0.3s',
                  mt: 0.1,
                }}>
                  {step.label}
                </Typography>
                {isActive && (
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      mt: 0.75, height: 3, borderRadius: 2,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                      '& .MuiLinearProgress-bar': { borderRadius: 2 },
                    }}
                  />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>

      <Box sx={{
        px: 3, pb: 2.5,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'}`,
        pt: 1.5,
      }}>
        <Typography sx={{ fontSize: 10.5, color: theme.palette.text.disabled, textAlign: 'center' }}>
          This may take a moment depending on video length
        </Typography>
      </Box>
    </Dialog>
  )
}
