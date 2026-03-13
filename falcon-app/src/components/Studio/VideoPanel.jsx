import { Box, Typography, CircularProgress, Tooltip, IconButton } from '@mui/material'
import MovieCreationOutlinedIcon from '@mui/icons-material/MovieCreationOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import { useTheme } from '@mui/material'
import { api } from '../../services/api'

function GeneratingState() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{
      aspectRatio: '16/9',
      width: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2.5,
      borderRadius: '14px',
      border: `1px solid ${theme.palette.divider}`,
      backgroundColor: isDark ? '#0d0d0d' : '#f8fafc',
    }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress size={48} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MovieCreationOutlinedIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: theme.palette.text.primary, mb: 0.5 }}>
          Generating video…
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
          Rendering animations and narration audio
        </Typography>
      </Box>
    </Box>
  )
}

function ReadyState({ sessionId }) {
  const videoUrl = api.getVideoUrl(sessionId)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `lesson_${sessionId.slice(0, 8)}.mp4`
    a.click()
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000' }}>
      <video
        src={videoUrl}
        controls
        style={{ width: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'contain' }}
      />
      {/* Download button overlay */}
      <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
        <Tooltip title="Download video">
          <IconButton
            onClick={handleDownload}
            size="small"
            sx={{
              backgroundColor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
            }}
          >
            <DownloadOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

function ErrorState() {
  const theme = useTheme()
  return (
    <Box sx={{
      aspectRatio: '16/9', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '14px', border: `1px dashed ${theme.palette.divider}`,
    }}>
      <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
        Video generation failed — check the server logs.
      </Typography>
    </Box>
  )
}

export default function VideoPanel({ sessionId, videoPhase }) {
  return (
    <Box sx={{ px: 3, pt: 1.5, pb: 1 }}>
      {videoPhase === 'generating' && <GeneratingState />}
      {videoPhase === 'ready'      && <ReadyState sessionId={sessionId} />}
      {videoPhase === 'error'      && <ErrorState />}
    </Box>
  )
}
