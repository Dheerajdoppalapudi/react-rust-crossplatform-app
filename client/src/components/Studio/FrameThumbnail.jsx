import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { api } from '../../services/api'

export default function FrameThumbnail({ sessionId, frameIndex, caption, type, isActive, onClick }) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const [imgError, setImgError] = useState(false)

  const showPlaceholder = type !== 'image' || imgError

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 130, height: 78,
        flexShrink: 0, borderRadius: '8px', overflow: 'hidden',
        cursor: 'pointer', position: 'relative',
        border: `2px solid ${isActive ? theme.palette.primary.main : (isDark ? '#2a2a2a' : '#e2e8f0')}`,
        backgroundColor: isDark ? '#141414' : '#f1f5f9',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          transform: 'scale(1.04)',
          boxShadow: `0 4px 12px ${theme.palette.primary.main}33`,
        },
      }}
    >
      {!showPlaceholder ? (
        <img
          src={api.getFrameUrl(sessionId, frameIndex)}
          alt={caption}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box sx={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0.5, p: 0.75,
        }}>
          {type === 'video'
            ? <PlayCircleOutlineIcon sx={{ fontSize: 22, color: theme.palette.primary.main, opacity: 0.7 }} />
            : <AutoAwesomeIcon sx={{ fontSize: 18, color: theme.palette.text.secondary, opacity: 0.35 }} />
          }
          <Typography sx={{
            fontSize: 9, color: theme.palette.text.secondary, opacity: 0.7,
            textAlign: 'center', lineHeight: 1.3, px: 0.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {caption}
          </Typography>
        </Box>
      )}

      {/* Frame number badge */}
      <Box sx={{
        position: 'absolute', top: 3, left: 3,
        minWidth: 16, height: 16, borderRadius: '4px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5,
      }}>
        <Typography sx={{ fontSize: 8, color: '#fff', fontWeight: 700, lineHeight: 1 }}>
          {frameIndex + 1}
        </Typography>
      </Box>

      {/* Active indicator glow */}
      {isActive && (
        <Box sx={{
          position: 'absolute', inset: 0,
          boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
          borderRadius: '6px',
          pointerEvents: 'none',
        }} />
      )}
    </Box>
  )
}
