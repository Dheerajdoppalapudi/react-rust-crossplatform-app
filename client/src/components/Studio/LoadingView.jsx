import { useState, useEffect } from 'react'
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

function BlockSkeletonPreview({ isDark }) {
  const BLOCKS = [
    { type: 'text',   lines: [1, 0.82, 0.58] },
    { type: 'entity', lines: []               },
    { type: 'text',   lines: [1, 0.68]        },
  ]
  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 340 }}>
      {BLOCKS.map((block, i) => (
        <Box key={i} sx={{
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative',
          animation: `${fadeIn} 0.5s ease both`,
          animationDelay: `${i * 0.22}s`,
        }}>
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
            animation: `${shimmer} 1.8s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }} />
          {block.type === 'text' ? (
            <Box sx={{ px: 1.5, py: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {block.lines.map((w, li) => (
                <Box key={li} sx={{
                  height: 7, borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  width: `${w * 100}%`,
                }} />
              ))}
            </Box>
          ) : (
            <Box sx={{ height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ opacity: 0.09, display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ width: 28, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
                  <Box sx={{ width: 28, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
                </Box>
                <Box sx={{ width: 2, height: 14, backgroundColor: isDark ? '#fff' : '#000' }} />
                <Box sx={{ width: 52, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
              </Box>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

// ── Fallback stage arrays for the old stage-string API (bootstrap overlay) ────

const _STEPS = [
  { key: 'planning',         label: 'Analyzing your question'  },
  { key: 'designing',        label: 'Designing the lesson'     },
  { key: 'generating',       label: 'Generating visual content'},
  { key: 'generating_frames',label: 'Generating frames'        },
  { key: 'rendering',        label: 'Rendering frames'         },
  { key: 'frames',           label: 'Visual frames ready'      },
  { key: 'video',            label: 'Generating video'         },
  // Research stages (used by bootstrap when SSE stage events arrive)
  { key: 'decomposing',      label: 'Understanding your question…'},
  { key: 'searching',        label: 'Searching the web…'       },
  { key: 'reading',          label: 'Reading sources…'         },
  { key: 'synthesising',     label: 'Synthesising answer…'     },
]

function _stageStringToArray(stageStr) {
  const idx = _STEPS.findIndex(s => s.key === stageStr)
  if (idx === -1) return [{ id: stageStr, label: stageStr, status: 'active' }]
  return [{ id: stageStr, label: _STEPS[idx].label, status: 'active' }]
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Renders a live stage progress list.
 *
 * Primary API: pass `stages` (SSE-driven array, no timers).
 * Fallback API: pass `stage` string (bootstrap overlay, old style).
 *
 * stages[].status: 'pending' | 'active' | 'done'
 * stages[].id: matches SSE stage names ('decomposing', 'searching', 'designing', etc.)
 */
export default function LoadingView({
  stages        = null,   // Array<{id, label, status, duration_s?}> — primary prop
  stage         = null,   // string fallback for bootstrap overlay
  compact       = false,
  framesData    = null,
  textMode      = false,
  mode          = null,
  synthesisText = '',     // streaming research tokens shown below stages
}) {
  const theme     = useTheme()
  const isDark    = theme.palette.mode === 'dark'
  const isInteractive = mode === 'interactive'

  // Timer only fires when using the old string API (bootstrap + interactive, no stages prop)
  const [timerFired, setTimerFired] = useState(false)
  useEffect(() => {
    if (stages?.length || !isInteractive || stage !== 'planning') return
    const t = setTimeout(() => setTimerFired(true), 1400)
    return () => clearTimeout(t)
  }, [stages, stage, isInteractive])

  // Derive the display stages array from whichever API was used
  let displayStages
  if (stages?.length) {
    displayStages = stages
  } else if (stage) {
    const effectiveStage = (isInteractive && stage === 'planning' && timerFired) ? 'designing' : stage
    displayStages = _stageStringToArray(effectiveStage)
  } else {
    displayStages = [{ id: 'planning', label: 'Planning…', status: 'active' }]
  }

  const mutedColor   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const activeColor  = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)'
  const pendingColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const lineColor    = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)'

  return (
    <Box role="status" aria-live="polite" aria-atomic="false" sx={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start',
      minHeight: compact ? 80 : (textMode || isInteractive ? 80 : 240),
      py: compact ? 1.5 : 3,
      px: compact ? 0   : 4,
    }}>
      {/* Screen reader live region */}
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {displayStages.find(s => s.status === 'active')?.label ?? 'Complete'}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 400 }}>
        {displayStages.map((s, i) => {
          const color = s.status === 'active' ? activeColor : s.status === 'done' ? mutedColor : pendingColor

          const showFrameSkeleton = (s.id === 'generating_frames' || s.id === 'generating' || s.id === 'rendering') && s.status === 'active'
          const showActualFrames  = s.id === 'frames' && s.status !== 'pending'
          const showVideoSkeleton = s.id === 'video' && s.status === 'active'
          const showBlockSkeleton = s.id === 'designing' && s.status === 'active'
          const showCards = showFrameSkeleton || showActualFrames || showVideoSkeleton || showBlockSkeleton
          const lineH = showCards
            ? (showVideoSkeleton ? 128 : showBlockSkeleton ? 260 : 96)
            : (compact ? 18 : 22)

          return (
            <Box key={`${s.id}-${i}`} sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1.5,
              opacity:        s.status === 'pending' ? 0.4 : 1,
              animation:      s.status !== 'pending' ? `${fadeIn} 0.35s ease both` : 'none',
              animationDelay: `${i * 0.08}s`,
            }}>
              {/* Vertical track */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: '5px' }}>
                {s.status === 'done' ? (
                  <CheckCircleOutlineIcon sx={{ fontSize: 10, color, flexShrink: 0 }} />
                ) : (
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0,
                    ...(s.status === 'active' ? { animation: `${pulse} 1.2s ease-in-out infinite` } : {}),
                  }} />
                )}
                {i < displayStages.length - 1 && (
                  <Box sx={{ width: 1.5, height: lineH, backgroundColor: lineColor, mt: 0.5 }} />
                )}
              </Box>

              {/* Label row */}
              <Box sx={{ pb: i < displayStages.length - 1 ? 0.75 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: compact ? 12.5 : 13, color, lineHeight: 1.4, transition: 'color 0.3s' }}>
                    {s.label}
                    {s.status === 'active' && (
                      <Box component="span" sx={{ animation: `${pulse} 1.2s ease-in-out infinite`, ml: 0.25 }}>…</Box>
                    )}
                  </Typography>
                  {s.status === 'done' && s.duration_s != null && (
                    <Typography sx={{ fontSize: 10, color: pendingColor }}>
                      {s.duration_s}s
                    </Typography>
                  )}
                </Box>

                {showFrameSkeleton  && <FrameSkeletonCards isDark={isDark} />}
                {showActualFrames   && (framesData?.sessionId
                  ? <ActualFrames sessionId={framesData.sessionId} count={framesData.framesData?.images?.length || 5} isDark={isDark} />
                  : <FrameSkeletonCards isDark={isDark} />
                )}
                {showVideoSkeleton  && <VideoSkeletonCard isDark={isDark} />}
                {showBlockSkeleton  && <BlockSkeletonPreview isDark={isDark} />}
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* Streaming research synthesis tokens */}
      {synthesisText && (
        <Box sx={{ mt: 1.5, maxWidth: 400 }}>
          <Typography sx={{
            fontSize: 12, color: mutedColor, lineHeight: 1.6,
            fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {synthesisText.length > 500
              ? `…${synthesisText.slice(-500)}`
              : synthesisText
            }
          </Typography>
        </Box>
      )}
    </Box>
  )
}
