import { useState, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography, Tooltip, useTheme } from '@mui/material'
import MovieOutlinedIcon    from '@mui/icons-material/MovieOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { useMediaUrl } from '../../../hooks/useMediaUrl'
import { NODE_W, NODE_H } from './useFlowData'

const THUMB_H = Math.round(NODE_W * 9 / 16)  // 146

export default function SessionNode({ data }) {
  const { turn } = data
  const theme    = useTheme()
  const isDark   = theme.palette.mode === 'dark'
  const [imgError,   setImgError]   = useState(false)
  const [thumbHover, setThumbHover] = useState(false)

  const frameCount  = turn.framesData?.captions?.length || turn.frame_count || 0
  const intentLabel = (turn.intent_type || '').replace(/_/g, ' ')
  const isReady     = turn.videoPhase === 'ready'
  const [duration, setDuration] = useState(null)

  const { videoUrl, getFrameUrl } = useMediaUrl(turn.id)
  const frameUrl = getFrameUrl(0)

  useEffect(() => {
    if (!turn.id || !isReady || !videoUrl) return
    const v = document.createElement('video')
    v.src = videoUrl
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const s = Math.round(v.duration)
      setDuration(s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)
    }
  }, [turn.id, isReady, videoUrl])

  const tooltipTitle = (
    <Box>
      <Typography sx={{ fontSize: 11, lineHeight: 1.5 }}>{turn.prompt || 'Untitled'}</Typography>
      <Typography sx={{ fontSize: 10, opacity: 0.6, mt: 0.5 }}>Click to view</Typography>
    </Box>
  )

  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />

      <Tooltip title={tooltipTitle} placement="top" arrow enterDelay={400}>
      <Box sx={{
        width:        NODE_W,
        height:       NODE_H,
        borderRadius: '10px',
        border:       `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e8ecf2'}`,
        bgcolor:      isDark ? '#1a1a1a' : '#ffffff',
        overflow:     'hidden',
        cursor:       'pointer',
        boxShadow:    isDark
          ? '0 2px 8px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.5)'
          : '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        transition:   'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          transform:   'translateY(-2px)',
          boxShadow:   isDark
            ? `0 0 0 1.5px ${theme.palette.primary.main}55, 0 16px 48px rgba(0,0,0,0.65)`
            : `0 0 0 1.5px ${theme.palette.primary.main}44, 0 12px 32px rgba(0,0,0,0.12)`,
        },
      }}>

        {/* ── Thumbnail ─────────────────────────────────────────────────────── */}
        <Box
          onMouseEnter={() => setThumbHover(true)}
          onMouseLeave={() => setThumbHover(false)}
          sx={{
            width: '100%', height: THUMB_H,
            bgcolor: isDark ? '#111' : '#f0f2f7',
            overflow: 'hidden', position: 'relative',
          }}
        >
          {turn.id && !imgError && frameUrl ? (
            <img
              src={frameUrl}
              alt="thumbnail"
              onError={() => setImgError(true)}
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                transition: 'transform 0.3s ease',
                transform: thumbHover ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          ) : (
            // Placeholder with subtle grid pattern
            <Box sx={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundImage: isDark
                ? 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)'
                : 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}>
              <MovieOutlinedIcon sx={{ fontSize: 30, opacity: 0.12, color: theme.palette.text.secondary }} />
            </Box>
          )}

          {/* Hover play overlay */}
          {thumbHover && turn.id && !imgError && frameUrl && (
            <Box sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.28)',
              transition: 'opacity 0.2s',
            }}>
              <PlayCircleOutlineIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.85)' }} />
            </Box>
          )}

          {/* Bottom gradient into card body */}
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
            pointerEvents: 'none',
            background: isDark
              ? 'linear-gradient(transparent, #1a1a1a)'
              : 'linear-gradient(transparent, #ffffff)',
          }} />

          {/* Badges */}
          <Box sx={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            {/* Intent badge */}
            {intentLabel && (
              <Box sx={{
                px: 0.75, py: 0.3, borderRadius: '20px',
                bgcolor: 'rgba(99,102,241,0.18)',
                border: '1px solid rgba(99,102,241,0.4)',
                backdropFilter: 'blur(6px)',
              }}>
                <Typography sx={{
                  fontSize: 8, fontWeight: 600, lineHeight: 1,
                  color: '#818cf8', textTransform: 'capitalize',
                }}>
                  {intentLabel}
                </Typography>
              </Box>
            )}

            {/* Duration / status badge */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 0.75, py: 0.3, borderRadius: '20px',
              bgcolor:        isReady ? 'rgba(34,197,94,0.18)'  : 'rgba(251,146,60,0.18)',
              border:         `1px solid ${isReady ? 'rgba(34,197,94,0.4)' : 'rgba(251,146,60,0.4)'}`,
              backdropFilter: 'blur(6px)',
            }}>
              <Box sx={{
                width: 5, height: 5, borderRadius: '50%',
                bgcolor: isReady ? '#22c55e' : '#fb923c',
              }} />
              <Typography sx={{
                fontSize: 8, fontWeight: 700, lineHeight: 1,
                color: isReady ? '#22c55e' : '#fb923c',
              }}>
                {isReady && duration ? duration : isReady ? 'READY' : 'GEN'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <Box sx={{ height: '1px', bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }} />

        {/* ── Info ──────────────────────────────────────────────────────────── */}
        <Box sx={{ px: 1.5, pt: 1, pb: 0.75 }}>
          <Typography sx={{
            fontSize: 12, fontWeight: 600, lineHeight: 1.45,
            color: theme.palette.text.primary,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            mb: 0.75,
          }}>
            {turn.prompt || 'Untitled'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Slide count + dots */}
            {frameCount > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                {Array.from({ length: Math.min(frameCount, 6) }).map((_, i) => (
                  <Box key={i} sx={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    bgcolor: theme.palette.primary.main, opacity: 0.5,
                  }} />
                ))}
                {frameCount > 6 && (
                  <Typography sx={{ fontSize: 9, color: theme.palette.text.secondary }}>
                    +{frameCount - 6}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 9.5, color: theme.palette.text.secondary, ml: 0.5 }}>
                  {frameCount} slides
                </Typography>
              </Box>
            ) : <Box />}

            {/* Intent badge */}
            {intentLabel && (
              <Typography sx={{
                fontSize: 9, fontWeight: 600, px: 0.75, py: 0.25,
                borderRadius: '5px', textTransform: 'capitalize', flexShrink: 0,
                bgcolor: isDark ? `${theme.palette.primary.main}18` : `${theme.palette.primary.main}12`,
                color:   theme.palette.primary.main,
              }}>
                {intentLabel}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      </Tooltip>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  )
}
