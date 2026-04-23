import { useEffect, useRef, useState } from 'react'
import { Dialog, Box, Typography, IconButton, Divider, useTheme, LinearProgress } from '@mui/material'
import CloseIcon    from '@mui/icons-material/Close'
import MergeTypeIcon from '@mui/icons-material/MergeType'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { getSessionMediaToken } from '../../../services/mediaToken'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  return `${m}:${ss}`
}

export default function MergedVideoModal({ open, onClose, mergedVideoUrl, sessions }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const videoRef      = useRef(null)
  const listRef       = useRef(null)
  const itemRefs      = useRef([])

  // Durations of each individual session video (loaded lazily)
  const [durations,    setDurations]    = useState([])   // [number, ...] seconds per session
  const [currentTime,  setCurrentTime]  = useState(0)
  const [activeIndex,  setActiveIndex]  = useState(0)

  // Load individual video durations when sessions change
  useEffect(() => {
    if (!sessions?.length) return
    setDurations([])
    setCurrentTime(0)
    setActiveIndex(0)

    let results  = new Array(sessions.length).fill(null)
    let loaded   = 0
    let cancelled = false

    const finish = (i, dur) => {
      results[i] = dur
      loaded++
      if (!cancelled && loaded === sessions.length) setDurations([...results])
    }

    sessions.forEach(async (s, i) => {
      try {
        const token = await getSessionMediaToken(s.id)
        if (cancelled) return
        const url = token
          ? `${API_BASE}/api/sessions/${s.id}/video?token=${token}`
          : ''
        if (!url) { finish(i, 0); return }
        const v   = document.createElement('video')
        v.preload = 'metadata'
        v.onloadedmetadata = () => { if (!cancelled) finish(i, v.duration || 0) }
        v.onerror          = () => { if (!cancelled) finish(i, 0) }
        v.src = url
      } catch {
        if (!cancelled) finish(i, 0)
      }
    })

    return () => { cancelled = true }
  }, [sessions])

  // Compute cumulative start times  e.g. [0, 42, 90, ...]
  const cumulative = durations.reduce((acc, d, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (durations[i - 1] || 0))
    return acc
  }, [])

  // Track video playback time
  const handleTimeUpdate = () => {
    const t = videoRef.current?.currentTime || 0
    setCurrentTime(t)

    if (!cumulative.length) return
    let idx = 0
    for (let i = cumulative.length - 1; i >= 0; i--) {
      if (t >= cumulative[i]) { idx = i; break }
    }
    setActiveIndex(idx)
  }

  // Scroll active session into view
  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el && listRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  // Click on session → seek video
  const seekToSession = (i) => {
    if (!cumulative.length || videoRef.current == null) return
    videoRef.current.currentTime = cumulative[i] || 0
    videoRef.current.play()
  }

  const durationsReady = durations.length === sessions?.length

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '92vw', height: '90vh',
          borderRadius: '12px',
          bgcolor: isDark ? '#111' : '#fff',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, py: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <MergeTypeIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Merged Learning Video</Typography>
        <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary }}>
          {sessions?.length} sessions
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: video player ──────────────────────────────────────────────── */}
        <Box sx={{
          width: '65%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          bgcolor: '#000', position: 'relative',
        }}>
          {mergedVideoUrl && (
            <video
              ref={videoRef}
              key={mergedVideoUrl}
              controls
              autoPlay
              onTimeUpdate={handleTimeUpdate}
              style={{ flex: 1, width: '100%', height: '100%', objectFit: 'contain', outline: 'none' }}
              src={mergedVideoUrl}
            />
          )}

          {/* Now Playing overlay at bottom */}
          {durationsReady && sessions?.[activeIndex] && (
            <Box sx={{
              position: 'absolute', bottom: 56, left: 0, right: 0,
              px: 2, py: 0,
              pointerEvents: 'none',
            }}>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.75,
                bgcolor: 'rgba(0,0,0,0.72)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                border: `1px solid ${theme.palette.primary.main}50`,
              }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: theme.palette.primary.main,
                  animation: 'blink 1.2s ease-in-out infinite',
                  '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
                  flexShrink: 0,
                }} />
                <Typography sx={{
                  fontSize: 11.5, fontWeight: 600, color: '#fff',
                  maxWidth: 480,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {sessions[activeIndex].prompt}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                  {activeIndex + 1}/{sessions.length}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Divider orientation="vertical" />

        {/* ── Right: session list ─────────────────────────────────────────────── */}
        <Box
          ref={listRef}
          sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <Typography sx={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
            color: theme.palette.text.secondary, mb: 0.5,
          }}>
            SESSION SEQUENCE
          </Typography>

          {sessions?.map((s, i) => {
            const isActive  = i === activeIndex
            const isDone    = durationsReady && cumulative[i] !== undefined && currentTime > (cumulative[i] + (durations[i] || 0))
            const startTime = durationsReady ? cumulative[i] : null
            const dur       = durationsReady ? (durations[i] || 0) : null

            // Progress within this session
            const sessionProgress = durationsReady && isActive && dur > 0
              ? Math.min(100, ((currentTime - cumulative[i]) / dur) * 100)
              : isDone ? 100 : 0

            return (
              <Box
                key={s.id}
                ref={(el) => { itemRefs.current[i] = el }}
                onClick={() => seekToSession(i)}
                sx={{
                  p: 1.5, borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
                  bgcolor: isActive
                    ? isDark ? `${theme.palette.primary.main}14` : `${theme.palette.primary.main}08`
                    : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                  transition: 'border-color 0.25s, background-color 0.25s',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    bgcolor: isDark ? `${theme.palette.primary.main}10` : `${theme.palette.primary.main}06`,
                  },
                }}
              >
                {/* Row: number badge + prompt + time */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    bgcolor: isActive ? theme.palette.primary.main : isDone ? `${theme.palette.primary.main}60` : isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.3s',
                  }}>
                    {isActive
                      ? <PlayArrowIcon sx={{ fontSize: 12, color: '#fff' }} />
                      : <Typography sx={{ fontSize: 9, fontWeight: 700, color: isDone ? '#fff' : theme.palette.text.secondary }}>{i + 1}</Typography>
                    }
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 11.5, fontWeight: isActive ? 600 : 400, lineHeight: 1.45,
                      color: isActive ? theme.palette.text.primary : isDone ? theme.palette.text.secondary : theme.palette.text.primary,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {s.prompt}
                    </Typography>
                  </Box>

                  {startTime != null && (
                    <Typography sx={{
                      fontSize: 9.5, color: theme.palette.text.disabled,
                      flexShrink: 0, mt: 0.2,
                    }}>
                      {fmtTime(startTime)}
                    </Typography>
                  )}
                </Box>

                {/* Progress bar — only shown when active or done */}
                {(isActive || isDone) && dur > 0 && (
                  <LinearProgress
                    variant="determinate"
                    value={sessionProgress}
                    sx={{
                      mt: 1, height: 2, borderRadius: 1,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 1,
                        bgcolor: isDone ? `${theme.palette.primary.main}60` : theme.palette.primary.main,
                      },
                    }}
                  />
                )}

                {s.notes && (
                  <Typography sx={{
                    fontSize: 10.5, color: theme.palette.text.secondary, lineHeight: 1.5,
                    pl: '28px', mt: 0.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {s.notes}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Dialog>
  )
}
