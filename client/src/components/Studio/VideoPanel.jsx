import { useState, useRef, useCallback, useEffect } from 'react'
import { Box, Typography, Tooltip, IconButton, Chip, CircularProgress, useTheme } from '@mui/material'
import DownloadOutlinedIcon       from '@mui/icons-material/DownloadOutlined'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import ClosedCaptionIcon          from '@mui/icons-material/ClosedCaption'
import ClosedCaptionDisabledIcon  from '@mui/icons-material/ClosedCaptionDisabled'
import { useMediaUrl } from '../../hooks/useMediaUrl'
import { useToast } from '../../contexts/ToastContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Format seconds as WebVTT timestamp: HH:MM:SS.mmm */
function vttTime(t) {
  const h  = Math.floor(t / 3600)
  const m  = Math.floor((t % 3600) / 60)
  const s  = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

/** Build a WebVTT string from frame captions and video duration. */
function buildVtt(captions, duration) {
  const frameDuration = duration / captions.length
  let vtt = 'WEBVTT\n\n'
  captions.forEach((caption, i) => {
    const start = i * frameDuration
    const end   = Math.min((i + 1) * frameDuration, duration)
    vtt += `${vttTime(start)} --> ${vttTime(end)}\n${caption}\n\n`
  })
  return vtt
}

// ─── Ready state ──────────────────────────────────────────────────────────────
function ReadyState({ sessionId, prompt, onPauseAsk, captions, frameCount, onFrameSync }) {
  const { videoUrl, loading: tokenLoading } = useMediaUrl(sessionId)
  const videoRef  = useRef(null)
  const toast     = useToast()

  const [isPaused,   setIsPaused]   = useState(false)
  const [duration,   setDuration]   = useState(0)
  // Captions on by default, persisted in localStorage
  const [captionsOn, setCaptionsOn] = useState(
    () => localStorage.getItem('zenith-captions-on') !== 'false'
  )
  // Blob URL for the generated WebVTT file
  const [vttUrl, setVttUrl] = useState(null)

  // ── Generate WebVTT blob whenever captions or duration become available ────
  useEffect(() => {
    if (!captions?.length || !duration) {
      setVttUrl(null)
      return
    }
    const vtt  = buildVtt(captions, duration)
    const blob = new Blob([vtt], { type: 'text/vtt' })
    const url  = URL.createObjectURL(blob)
    setVttUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [captions, duration])

  // ── Control the native TextTrack mode whenever captionsOn or track changes ─
  useEffect(() => {
    const video = videoRef.current
    if (!video || !vttUrl) return
    // The track element may not be attached yet — poll briefly
    const apply = () => {
      const track = Array.from(video.textTracks).find(
        (t) => t.kind === 'captions' || t.kind === 'subtitles'
      )
      if (track) {
        track.mode = captionsOn ? 'showing' : 'hidden'
      }
    }
    apply()
    // Also apply on the next tick in case the <track> isn't in the DOM yet
    const t = setTimeout(apply, 50)
    return () => clearTimeout(t)
  }, [captionsOn, vttUrl])

  const toggleCaptions = useCallback(() => {
    setCaptionsOn((prev) => {
      const next = !prev
      localStorage.setItem('zenith-captions-on', String(next))
      return next
    })
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (video) setDuration(video.duration)
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || !frameCount || !video.duration) return
    const frame = Math.min(
      Math.floor((video.currentTime / video.duration) * frameCount),
      frameCount - 1
    )
    onFrameSync?.(frame)
  }, [frameCount, onFrameSync])

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

  const hasCaptions = captions?.length > 0

  return (
    <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000',
      // Style the native WebVTT cue to match the Zenith aesthetic.
      // ::cue can only be targeted via a <style> tag; we inject it as a child.
    }}>

      {/* Inject ::cue styles so the native caption box matches our design */}
      <style>{`
        video::-webkit-media-text-track-display { pointer-events: none; }
        ::cue {
          background-color: rgba(0, 0, 0, 0.72);
          color: #ffffff;
          font-size: 0.88em;
          font-family: "Sora", system-ui, sans-serif;
          font-weight: 500;
          line-height: 1.5;
          border-radius: 4px;
          padding: 2px 6px;
        }
      `}</style>

      <video
        ref={videoRef}
        src={videoUrl || undefined}
        controls
        onPause={() => setIsPaused(true)}
        onPlay={() => setIsPaused(false)}
        onEnded={() => setIsPaused(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        style={{ width: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'contain' }}
      >
        {/* WebVTT track — gives a native CC button in Chrome/Edge controls */}
        {vttUrl && (
          <track
            key={vttUrl}
            src={vttUrl}
            kind="captions"
            srcLang="en"
            label="English"
          />
        )}
      </video>

      {/* Top-right action buttons */}
      <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 0.75 }}>
        {hasCaptions && (
          <Tooltip title={captionsOn ? 'Captions on — click to turn off' : 'Captions off — click to turn on'}>
            <IconButton
              onClick={toggleCaptions}
              size="small"
              aria-label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
              aria-pressed={captionsOn}
              sx={{
                backgroundColor: captionsOn ? 'rgba(79,110,255,0.82)' : 'rgba(0,0,0,0.55)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  backgroundColor: captionsOn ? 'rgba(79,110,255,1)' : 'rgba(0,0,0,0.75)',
                },
                transition: 'background-color 0.15s',
              }}
            >
              {captionsOn
                ? <ClosedCaptionIcon sx={{ fontSize: 16 }} />
                : <ClosedCaptionDisabledIcon sx={{ fontSize: 16 }} />
              }
            </IconButton>
          </Tooltip>
        )}

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
 *   sessionId   — string
 *   videoPhase  — 'ready' | 'error'
 *   prompt      — string
 *   onPauseAsk  — () => void
 *   captions    — string[]  (one caption per frame)
 *   frameCount  — number
 *   onFrameSync — (frameIndex: number) => void
 */
export default function VideoPanel({ sessionId, videoPhase, prompt, onPauseAsk, captions, frameCount, onFrameSync }) {
  return (
    <>
      {videoPhase === 'ready' && (
        <ReadyState
          sessionId={sessionId}
          prompt={prompt}
          onPauseAsk={onPauseAsk}
          captions={captions}
          frameCount={frameCount}
          onFrameSync={onFrameSync}
        />
      )}
      {videoPhase === 'error' && <ErrorState />}
    </>
  )
}
