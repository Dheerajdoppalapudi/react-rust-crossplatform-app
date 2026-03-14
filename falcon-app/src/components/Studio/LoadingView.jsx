import { Box, Typography, keyframes, useTheme } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
`
const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`

const STEPS = [
  {
    key:  'planning',
    label: 'Analyzing your question',
    sub:   'Deciding frame structure and visual approach',
  },
  {
    key:  'generating',
    label: 'Generating visual content',
    sub:   'Creating AI-powered diagrams and animations',
  },
  {
    key:  'rendering',
    label: 'Rendering frames',
    sub:   'Compiling the final output',
  },
]

function StepDot({ status, isDark }) {
  // status: 'done' | 'active' | 'pending'
  if (status === 'done') {
    return (
      <Box sx={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        backgroundColor: '#22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckIcon sx={{ fontSize: 12, color: '#fff' }} />
      </Box>
    )
  }
  if (status === 'active') {
    return (
      <Box sx={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
        {/* Outer pulsing ring */}
        <Box sx={{
          position: 'absolute', inset: -4,
          borderRadius: '50%',
          border: `2px solid ${isDark ? 'rgba(79,110,255,0.35)' : 'rgba(0,26,255,0.2)'}`,
          animation: `${pulse} 1.4s ease-in-out infinite`,
        }} />
        {/* Spinning arc */}
        <Box sx={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: isDark ? '#4F6EFF' : '#001AFF',
          animation: `${spin} 0.9s linear infinite`,
        }} />
        {/* Inner filled dot */}
        <Box sx={{
          position: 'absolute', inset: 4,
          borderRadius: '50%',
          backgroundColor: isDark ? '#4F6EFF' : '#001AFF',
        }} />
      </Box>
    )
  }
  // pending
  return (
    <Box sx={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    }} />
  )
}

export default function LoadingView({ stage, compact = false }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const current = STEPS.findIndex((s) => s.key === stage)

  return (
    <Box sx={{
      flex:      compact ? undefined : 1,
      minHeight: compact ? 140 : 360,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      py: compact ? 2 : 0,
    }}>
      <Box sx={{
        display: 'flex', flexDirection: 'column', gap: 0,
        minWidth: compact ? 260 : 300,
      }}>
        {STEPS.map((step, i) => {
          const status = i < current ? 'done' : i === current ? 'active' : 'pending'
          const isLast = i === STEPS.length - 1

          return (
            <Box
              key={step.key}
              sx={{
                display: 'flex', gap: 1.75,
                animation: status !== 'pending' ? `${fadeIn} 0.3s ease both` : 'none',
                animationDelay: `${i * 0.08}s`,
              }}
            >
              {/* Left: dot + connector line */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.2 }}>
                <StepDot status={status} isDark={isDark} />
                {!isLast && (
                  <Box sx={{
                    width: 2, flex: 1, minHeight: compact ? 24 : 28, mt: 0.5,
                    backgroundColor: i < current
                      ? '#22c55e'
                      : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderRadius: 1,
                    transition: 'background-color 0.4s',
                  }} />
                )}
              </Box>

              {/* Right: text */}
              <Box sx={{ pb: isLast ? 0 : compact ? 2.5 : 3, pt: 0.1 }}>
                <Typography sx={{
                  fontSize: compact ? 13 : 14,
                  fontWeight: status === 'active' ? 600 : status === 'done' ? 500 : 400,
                  color: status === 'active'
                    ? theme.palette.text.primary
                    : status === 'done'
                      ? (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)')
                      : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                  lineHeight: 1.4,
                  transition: 'color 0.3s',
                }}>
                  {step.label}
                  {status === 'active' && (
                    <Box component="span" sx={{
                      display: 'inline-block', ml: 0.5,
                      animation: `${pulse} 1s ease-in-out infinite`,
                    }}>…</Box>
                  )}
                </Typography>

                {status === 'active' && !compact && (
                  <Typography sx={{
                    fontSize: 12, color: theme.palette.text.secondary,
                    opacity: 0.6, mt: 0.3, lineHeight: 1.5,
                  }}>
                    {step.sub}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
