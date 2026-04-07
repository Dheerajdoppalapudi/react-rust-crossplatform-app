import { useState, useRef, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, Chip, CircularProgress, useTheme } from '@mui/material'
import DownloadOutlinedIcon       from '@mui/icons-material/DownloadOutlined'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import { useMediaUrl } from '../../hooks/useMediaUrl'
import { useToast } from '../../contexts/ToastContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a human-readable filename from the session prompt. */
function buildFilename(prompt, sessionId) {
  if (prompt) {
    const slug = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 48)
    return `${slug}.mp4`
  }
  return `zenith_${sessionId.slice(0, 8)}.mp4`
}

// ─── Ready state ──────────────────────────────────────────────────────────────
function ReadyState({ sessionId, prompt, onPauseAsk }) {
  // CRIT-2: useMediaUrl fetches a short-lived session-scoped media token so the
  // main access JWT never appears in a URL query string.
  const { videoUrl, loading: tokenLoading } = useMediaUrl(sessionId)
  const videoRef = useRef(null)
  const toast    = useToast()
  const [isPaused, setIsPaused] = useState(false)

  const handleDownload = useCallback(() => {
    if (!videoUrl) return
    try {
      const a    = document.createElement('a')
      a.href     = videoUrl
      a.download = buildFilename(prompt, sessionId)
      a.click()
      toast.success('Download started.')
    } catch {
      toast.error('Download failed. Try right-clicking the video to save.')
    }
  }, [videoUrl, prompt, sessionId, toast])

  const handleAskHere = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    onPauseAsk?.({ sessionId, currentTime: video.currentTime, duration: video.duration || 1 })
  }, [sessionId, onPauseAsk])

  if (tokenLoading) {
    return (
      <Box sx={{
        aspectRatio: '16/9', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '12px', backgroundColor: '#000',
      }}>
        <CircularProgress size={28} sx={{ color: '#fff' }} />
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        src={videoUrl || undefined}
        controls
        onPause={() => setIsPaused(true)}
        onPlay={() => setIsPaused(false)}
        onEnded={() => setIsPaused(false)}
        style={{ width: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'contain' }}
      />

      {/* Download button — top right */}
      <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
        <Tooltip title="Download video">
          <IconButton
            onClick={handleDownload}
            size="small"
            aria-label="Download video"
            sx={{
              backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
              backdropFilter: 'blur(4px)',
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
              backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.18)', height: 34,
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

// ─── Error state ──────────────────────────────────────────────────────────────
// Retry lives in ConversationThread (RetryBanner) — this is intentionally minimal.
function ErrorState() {
  const theme = useTheme()
  return (
    <Box sx={{
      aspectRatio: '16/9', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '12px', border: `1px dashed ${theme.palette.divider}`,
    }}>
      <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, textAlign: 'center', px: 2 }}>
        Video unavailable for this session.
      </Typography>
    </Box>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
/**
 * Props:
 *   sessionId  — string
 *   videoPhase — 'ready' | 'error'
 *   prompt     — string (used for the download filename)
 *   onPauseAsk — called when user pauses and clicks "Ask about this moment"
 */
export default function VideoPanel({ sessionId, videoPhase, prompt, onPauseAsk }) {
  return (
    <>
      {videoPhase === 'ready' && (
        <ReadyState sessionId={sessionId} prompt={prompt} onPauseAsk={onPauseAsk} />
      )}
      {videoPhase === 'error' && <ErrorState />}
    </>
  )
}
