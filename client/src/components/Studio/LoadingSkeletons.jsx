import { Box, Typography } from '@mui/material'
import MovieCreationOutlinedIcon from '@mui/icons-material/MovieCreationOutlined'
import { fadeIn, shimmer, softPulse } from '../../theme/animations'
import { neutralBorder } from '../../theme/styleUtils.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const shimmerBg  = (d) => d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
const skeletonBg = (d) => d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'

const FRAME_COUNT   = 5
const FRAME_INDICES = Array.from({ length: FRAME_COUNT }, (_, i) => i)

// ── Shared shimmer overlay ────────────────────────────────────────────────────

export function ShimmerOverlay({ isDark, delay = 0 }) {
  return (
    <Box sx={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
      animation: `${shimmer} 1.7s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }} />
  )
}

// ── Frame thumbnails (video loading) ─────────────────────────────────────────

export function FrameSkeletonCards({ isDark }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
      {FRAME_INDICES.map((i) => (
        <Box key={i} sx={{
          width: 68, height: 50, borderRadius: '6px',
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative', flexShrink: 0,
          animation: `${fadeIn} 0.4s ease both`,
          animationDelay: `${i * 0.1}s`,
        }}>
          <ShimmerOverlay isDark={isDark} delay={i * 0.18} />
          <Typography sx={{
            position: 'absolute', bottom: 3, right: 4,
            fontSize: 8, fontWeight: 600, userSelect: 'none',
            color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
          }}>
            {i + 1}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// ── Slide deck skeleton ───────────────────────────────────────────────────────

export function SlideSkeletonCard({ isDark }) {
  const slides = [0, 1, 2]
  return (
    <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, mb: 0.5, alignItems: 'flex-end' }}>
      {slides.map((i) => (
        <Box key={i} sx={{
          flex: i === 0 ? '0 0 120px' : '0 0 76px',
          height: i === 0 ? 72 : 48,
          borderRadius: '6px',
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative',
          animation: `${fadeIn} 0.4s ease both`,
          animationDelay: `${i * 0.12}s`,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <ShimmerOverlay isDark={isDark} delay={i * 0.2} />
          {i === 0 && (
            <Box sx={{ position: 'absolute', inset: 0, p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ height: 5, width: '72%', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
              <Box sx={{ height: 3.5, width: '90%', borderRadius: '2px', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} />
              <Box sx={{ height: 3.5, width: '60%', borderRadius: '2px', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

// ── p5 animation skeleton ─────────────────────────────────────────────────────

export function P5SkeletonCard({ isDark }) {
  const bars = [0.55, 0.88, 0.5, 1, 0.72, 0.85, 0.45, 0.68, 0.58, 0.92]
  return (
    <Box sx={{
      width: '100%', maxWidth: 240, height: 88, borderRadius: '8px',
      backgroundColor: skeletonBg(isDark), overflow: 'hidden', position: 'relative',
      mt: 1.5, mb: 0.5, animation: `${fadeIn} 0.4s ease both`,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <ShimmerOverlay isDark={isDark} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2.5px', px: 2, pb: '14%' }}>
        {bars.map((h, i) => (
          <Box key={i} sx={{
            flex: 1, borderRadius: '2px 2px 0 0',
            backgroundColor: neutralBorder(isDark),
            height: `${h * 60}%`,
            animation: `${softPulse} ${1.4 + i * 0.09}s ease-in-out infinite`,
            animationDelay: `${i * 0.06}s`,
          }} />
        ))}
      </Box>
    </Box>
  )
}

// ── Video skeleton ────────────────────────────────────────────────────────────

export function VideoSkeletonCard({ isDark }) {
  return (
    <Box sx={{
      width: '100%', maxWidth: 280, aspectRatio: '16/9', borderRadius: '8px',
      backgroundColor: skeletonBg(isDark), overflow: 'hidden', position: 'relative',
      mt: 1.5, mb: 0.5, animation: `${fadeIn} 0.4s ease both`,
    }}>
      <ShimmerOverlay isDark={isDark} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MovieCreationOutlinedIcon sx={{ fontSize: 28, opacity: 0.1, color: isDark ? '#fff' : '#000' }} />
      </Box>
    </Box>
  )
}

// ── Generic block skeleton ────────────────────────────────────────────────────

export function BlockSkeletonPreview({ isDark }) {
  const BLOCKS = [
    { type: 'text',   lines: [1, 0.82, 0.58] },
    { type: 'entity', lines: []               },
    { type: 'text',   lines: [1, 0.68]        },
  ]
  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 320 }}>
      {BLOCKS.map((block, i) => (
        <Box key={i} sx={{
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative',
          animation: `${fadeIn} 0.5s ease both`,
          animationDelay: `${i * 0.2}s`,
        }}>
          <ShimmerOverlay isDark={isDark} delay={i * 0.25} />
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
            <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ opacity: 0.08, display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
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
