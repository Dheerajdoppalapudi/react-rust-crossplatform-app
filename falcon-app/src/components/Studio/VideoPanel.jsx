import { useState, useRef, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, Chip, useTheme } from '@mui/material'
import DownloadOutlinedIcon      from '@mui/icons-material/DownloadOutlined'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import { api } from '../../services/api'

// ─── Video player with pause-to-ask overlay ────────────────────────────────────
function ReadyState({ sessionId, onPauseAsk }) {
  const theme    = useTheme()
  const videoUrl = api.getVideoUrl(sessionId)
  const videoRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `lesson_${sessionId.slice(0, 8)}.mp4`
    a.click()
  }

  const handleAskHere = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    onPauseAsk?.({ sessionId, currentTime: video.currentTime, duration: video.duration || 1 })
  }, [sessionId, onPauseAsk])

  return (
    <Box sx={{
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#000',
    }}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onPause={() => setIsPaused(true)}
        onPlay={() => setIsPaused(false)}
        onEnded={() => setIsPaused(false)}
        style={{ width: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'contain' }}
      />

      {/* Download — top right */}
      <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
        <Tooltip title="Download video">
          <IconButton
            onClick={handleDownload}
            size="small"
            sx={{
              backgroundColor: 'rgba(0,0,0,0.55)',
              color: '#fff', backdropFilter: 'blur(4px)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
            }}
          >
            <DownloadOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Pause-to-ask chip */}
      {isPaused && onPauseAsk && (
        <Box sx={{
          position: 'absolute', bottom: 52, left: '50%',
          transform: 'translateX(-50%)', zIndex: 10,
        }}>
          <Chip
            icon={<QuestionAnswerOutlinedIcon sx={{ fontSize: 14 }} />}
            label="Ask about this moment"
            onClick={handleAskHere}
            sx={{
              cursor: 'pointer', fontWeight: 600, fontSize: 12.5,
              backgroundColor: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
              height: 34,
              '&:hover': { backgroundColor: 'rgba(79,110,255,0.85)' },
              transition: 'all 0.15s',
              '& .MuiChip-icon': { color: '#fff' },
            }}
          />
        </Box>
      )}
    </Box>
  )
}

// ─── Error state ───────────────────────────────────────────────────────────────
function ErrorState() {
  const theme = useTheme()
  return (
    <Box sx={{
      aspectRatio: '16/9', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '12px',
      border: `1px dashed ${theme.palette.divider}`,
    }}>
      <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
        Video generation failed — check the server logs.
      </Typography>
    </Box>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function VideoPanel({ sessionId, videoPhase, onPauseAsk }) {
  return (
    <>
      {videoPhase === 'ready' && <ReadyState sessionId={sessionId} onPauseAsk={onPauseAsk} />}
      {videoPhase === 'error' && <ErrorState />}
    </>
  )
}
