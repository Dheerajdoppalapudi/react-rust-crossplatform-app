import { Box, Typography, useTheme } from '@mui/material'
import CheckCircleOutlineIcon    from '@mui/icons-material/CheckCircleOutline'
import MovieCreationOutlinedIcon from '@mui/icons-material/MovieCreationOutlined'
import { pulse, fadeIn, shimmer, blink } from '../../theme/animations'
import { useMediaUrl } from '../../hooks/useMediaUrl'

function shimmerBg(isDark) { return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }
function skeletonBg(isDark) { return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }

const FRAME_COUNT   = 5
const FRAME_INDICES = Array.from({ length: FRAME_COUNT }, (_, i) => i)

function FrameSkeletonCards({ isDark }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
      {FRAME_INDICES.map((i) => (
        <Box key={i} sx={{
          width: 72, height: 54, borderRadius: '6px',
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative', flexShrink: 0,
          animation: `${fadeIn} 0.4s ease both`,
          animationDelay: `${i * 0.12}s`,
        }}>
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
            animation: `${shimmer} 1.6s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
          <Typography sx={{
            position: 'absolute', bottom: 4, right: 5,
            fontSize: 9, fontWeight: 600, userSelect: 'none',
            color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
          }}>
            {i + 1}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function ActualFrames({ sessionId, count, isDark }) {
  const { getFrameUrl } = useMediaUrl(sessionId)
  const overlayColor = isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)'
  const indices = Array.from({ length: Math.min(count, FRAME_COUNT) }, (_, i) => i)
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
      {indices.map((i) => {
        const src = getFrameUrl(i)
        return (
          <Box key={i} sx={{
            width: 72, height: 54, borderRadius: '6px', overflow: 'hidden',
            flexShrink: 0, position: 'relative',
            animation: `${fadeIn} 0.4s ease both`,
            animationDelay: `${i * 0.1}s`,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            {src && (
              <img src={src} alt={`frame ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            <Box sx={{
              position: 'absolute', inset: 0,
              backgroundColor: overlayColor,
              animation: `${blink} 1.6s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
              borderRadius: '6px',
            }} />
          </Box>
        )
      })}
    </Box>
  )
}

function VideoSkeletonCard({ isDark }) {
  return (
    <Box sx={{
      width: '100%', maxWidth: 290, aspectRatio: '16/9', borderRadius: '8px',
      backgroundColor: skeletonBg(isDark), overflow: 'hidden', position: 'relative',
      mt: 1.25, mb: 0.5, animation: `${fadeIn} 0.4s ease both`,
    }}>
      <Box sx={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
        animation: `${shimmer} 1.8s ease-in-out infinite`,
      }} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MovieCreationOutlinedIcon sx={{ fontSize: 30, opacity: 0.12, color: isDark ? '#fff' : '#000' }} />
      </Box>
    </Box>
  )
}

const STEPS = [
  { key: 'planning',   label: 'Analyzing your question' },
  { key: 'generating', label: 'Generating visual content' },
  { key: 'rendering',  label: 'Rendering frames' },
  { key: 'frames',     label: 'Visual frames ready' },
  { key: 'video',      label: 'Generating video' },
]

const TEXT_STEPS = [{ key: 'planning', label: 'Thinking' }]

export default function LoadingView({ stage, compact = false, framesData = null, textMode = false }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const steps   = textMode ? TEXT_STEPS : STEPS
  const current = steps.findIndex((s) => s.key === stage)

  const mutedColor   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const activeColor  = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)'
  const pendingColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const lineColor    = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)'

  return (
    <Box role="status" aria-live="polite" aria-atomic="false" sx={{
      position: 'relative', display: 'flex', alignItems: 'flex-start',
      minHeight: compact ? 80 : (textMode ? 80 : 240),
      py: compact ? 1.5 : 3,
      px: compact ? 0   : 4,
    }}>
      <Box sx={{
        position: 'absolute', width: 1, height: 1,
        overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
      }}>
        {steps[current]?.label ?? 'Complete'}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 400 }}>
        {steps.map((step, i) => {
          const status = i < current ? 'done' : i === current ? 'active' : 'pending'
          const color  = status === 'active' ? activeColor : status === 'done' ? mutedColor : pendingColor

          const showSkeletons     = (step.key === 'generating' || step.key === 'rendering') && status === 'active'
          const showFrames        = step.key === 'frames' && status !== 'pending'
          const showVideoSkeleton = step.key === 'video' && status === 'active'
          const showCards         = showSkeletons || showFrames || showVideoSkeleton
          const lineH             = showCards ? (showVideoSkeleton ? 128 : 96) : (compact ? 18 : 22)

          return (
            <Box key={step.key} sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1.5,
              opacity:        status === 'pending' ? 0.4 : 1,
              animation:      status !== 'pending' ? `${fadeIn} 0.35s ease both` : 'none',
              animationDelay: `${i * 0.08}s`,
            }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: '5px' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                {i < steps.length - 1 && (
                  <Box sx={{ width: 1.5, height: lineH, backgroundColor: lineColor, mt: 0.5 }} />
                )}
              </Box>

              <Box sx={{ pb: i < steps.length - 1 ? 0.75 : 0 }}>
                <Typography sx={{ fontSize: compact ? 12.5 : 13, color, lineHeight: 1.4, transition: 'color 0.3s' }}>
                  {step.label}
                  {status === 'active' && (
                    <Box component="span" sx={{ animation: `${pulse} 1.2s ease-in-out infinite`, ml: 0.25 }}>…</Box>
                  )}
                </Typography>

                {showSkeletons     && <FrameSkeletonCards isDark={isDark} />}
                {showFrames        && (framesData?.sessionId
                  ? <ActualFrames sessionId={framesData.sessionId} count={framesData.framesData?.images?.length || 5} isDark={isDark} />
                  : <FrameSkeletonCards isDark={isDark} />
                )}
                {showVideoSkeleton && <VideoSkeletonCard isDark={isDark} />}
              </Box>
            </Box>
          )
        })}

        {current === steps.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, animation: `${fadeIn} 0.3s ease both` }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: mutedColor }} />
            <Typography sx={{ fontSize: 12, color: mutedColor }}>Done</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
