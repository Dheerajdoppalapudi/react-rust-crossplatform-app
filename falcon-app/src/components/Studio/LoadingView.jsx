import { Box, Typography, keyframes, useTheme } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { api } from '../../services/api'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`
const shimmer = keyframes`
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`
const blink = keyframes`
  0%, 100% { opacity: 0; }
  50%       { opacity: 0.35; }
`

const FRAME_COUNT = 5

function FrameSkeletonCards({ isDark }) {
  const bg      = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const shimBg  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
      {Array.from({ length: FRAME_COUNT }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: 72, height: 54,
            borderRadius: '6px',
            backgroundColor: bg,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            animation: `${fadeIn} 0.4s ease both`,
            animationDelay: `${i * 0.12}s`,
          }}
        >
          {/* shimmer sweep */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${shimBg} 50%, transparent 100%)`,
            animation: `${shimmer} 1.6s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
          {/* frame number hint */}
          <Typography sx={{
            position: 'absolute', bottom: 4, right: 5,
            fontSize: 9, fontWeight: 600,
            color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
            userSelect: 'none',
          }}>
            {i + 1}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

const STEPS = [
  { key: 'planning',   label: 'Analyzing your question' },
  { key: 'generating', label: 'Generating visual content' },
  { key: 'rendering',  label: 'Rendering frames' },
  { key: 'frames',     label: 'Visual frames ready' },
  { key: 'video',      label: 'Generating video…' },
]

function ActualFrames({ sessionId, count, isDark }) {
  const overlayColor = isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)'
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: 72, height: 54, borderRadius: '6px', overflow: 'hidden', flexShrink: 0,
            position: 'relative',
            animation: `${fadeIn} 0.4s ease both`,
            animationDelay: `${i * 0.1}s`,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <img
            src={api.getFrameUrl(sessionId, i)}
            alt={`frame ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* blink overlay */}
          <Box sx={{
            position: 'absolute', inset: 0,
            backgroundColor: overlayColor,
            animation: `${blink} 1.6s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
            borderRadius: '6px',
          }} />
        </Box>
      ))}
    </Box>
  )
}

export default function LoadingView({ stage, compact = false, framesData = null }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const current = STEPS.findIndex((s) => s.key === stage)

  const mutedColor   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const activeColor  = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)'
  const pendingColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const lineColor    = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)'

  return (
    <Box sx={{
      flex:      compact ? undefined : 1,
      minHeight: compact ? 100 : 260,
      display: 'flex',
      alignItems: 'flex-start',
      py: compact ? 1.5 : 3,
      px: compact ? 1.5 : 4,
    }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 380 }}>

        {/* Steps */}
        {STEPS.map((step, i) => {
          const status        = i < current ? 'done' : i === current ? 'active' : 'pending'
          const color         = status === 'active' ? activeColor : status === 'done' ? mutedColor : pendingColor
          const showSkeletons = (step.key === 'generating' || step.key === 'rendering') && status === 'active' && !compact
          const showFrames    = step.key === 'frames' && status !== 'pending' && !compact
          const showCards     = showSkeletons || showFrames

          return (
            <Box
              key={step.key}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                opacity: status === 'pending' ? 0.4 : 1,
                animation: status !== 'pending' ? `${fadeIn} 0.35s ease both` : 'none',
                animationDelay: `${i * 0.08}s`,
              }}
            >
              {/* Left: dot + line */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: '5px' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                {i < STEPS.length - 1 && (
                  <Box sx={{
                    width: 1.5,
                    height: showCards ? (showFrames ? 100 : 90) : (compact ? 18 : 22),
                    backgroundColor: lineColor,
                    mt: 0.5,
                  }} />
                )}
              </Box>

              {/* Right: label + cards */}
              <Box sx={{ pb: i < STEPS.length - 1 ? (compact ? 0.5 : 0.75) : 0 }}>
                <Typography sx={{
                  fontSize: compact ? 12 : 13,
                  color,
                  lineHeight: 1.4,
                  transition: 'color 0.3s',
                }}>
                  {step.label}
                  {status === 'active' && (
                    <Box component="span" sx={{ animation: `${pulse} 1.2s ease-in-out infinite`, ml: 0.25 }}>
                      …
                    </Box>
                  )}
                </Typography>
                {showSkeletons && <FrameSkeletonCards isDark={isDark} />}
                {showFrames && (
                  framesData?.sessionId
                    ? <ActualFrames sessionId={framesData.sessionId} count={framesData.framesData?.images?.length || 5} isDark={isDark} />
                    : <FrameSkeletonCards isDark={isDark} />
                )}
              </Box>
            </Box>
          )
        })}

        {/* Done footer */}
        {current === STEPS.length && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, mt: 1,
            animation: `${fadeIn} 0.3s ease both`,
          }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: mutedColor }} />
            <Typography sx={{ fontSize: 12, color: mutedColor }}>Done</Typography>
          </Box>
        )}

      </Box>
    </Box>
  )
}
