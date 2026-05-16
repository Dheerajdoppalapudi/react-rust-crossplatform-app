import { Box } from '@mui/material'
import MovieCreationOutlinedIcon from '@mui/icons-material/MovieCreationOutlined'
import { useTheme } from '@mui/material'
import { keyframes } from '@mui/material'
import LoadingView from './LoadingView'

const shimmer = keyframes`
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`

function shimmerBg(isDark) {
  return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
}

export default function VideoAssemblingView({ turn }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box>
      {/* 16:9 skeleton where the video will appear */}
      <Box sx={{
        width: '100%', aspectRatio: '16/9',
        borderRadius: '10px', overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)',
        position: 'relative',
        mb: 1.5,
      }}>
        {/* Shimmer sweep */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
          animation: `${shimmer} 1.8s ease-in-out infinite`,
        }} />
        {/* Centered icon hint */}
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MovieCreationOutlinedIcon sx={{
            fontSize: 32,
            color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          }} />
        </Box>
      </Box>

      {/* Video-phase stage rows (assembling, export, tts, etc.) */}
      {turn.videoStages?.length > 0 && (
        <LoadingView
          stages={turn.videoStages}
          stage="assembling"
          compact
        />
      )}
    </Box>
  )
}
