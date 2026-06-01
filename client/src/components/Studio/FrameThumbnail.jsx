import { useState, memo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import ZenithLogo from '../common/ZenithLogo'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { PALETTE } from '../../theme/tokens.js'
import { neutralBorderDefault, neutralBorderStrong, neutralBorderHover } from '../../theme/styleUtils.js'
import { thumbShimmer } from '../../theme/animations.js'

// getFrameUrl is provided by the parent (FrameStrip or SessionView) so that all
// thumbnails in one session share a single useMediaUrl instance and one refresh interval.
function FrameThumbnail({
  getFrameUrl,
  frameIndex,
  caption,
  type,
  isActive,
  onClick,
  role,
  'aria-selected': ariaSelected,
}) {
  const theme       = useTheme()
  const isDark      = theme.palette.mode === 'dark'
  const [imgError,   setImgError]   = useState(false)
  const [imgLoading, setImgLoading] = useState(true)

  const frameUrl = getFrameUrl(frameIndex)
  // Show placeholder when: not an image type, token not loaded yet (empty URL), or img load failed.
  const showPlaceholder = type !== 'image' || !frameUrl || imgError

  return (
    <Box
      onClick={onClick}
      role={role}
      aria-selected={ariaSelected}
      sx={{
        width: 130, height: 78,
        flexShrink: 0, borderRadius: '8px', overflow: 'hidden',
        cursor: 'pointer', position: 'relative',
        border: `2px solid ${isActive ? neutralBorderStrong(isDark) : neutralBorderDefault(isDark)}`,
        backgroundColor: isDark ? PALETTE.nearBlack : PALETTE.warmSand,
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: neutralBorderHover(isDark),
          transform: 'scale(1.04)',
        },
      }}
    >
      {/* Shimmer while image loads */}
      {!showPlaceholder && imgLoading && (
        <Box sx={{
          position: 'absolute', inset: 0,
          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
          '&::after': {
            content: '""', position: 'absolute', inset: 0,
            background: isDark
              ? 'linear-gradient(90deg,transparent 20%,rgba(255,255,255,0.08) 50%,transparent 80%)'
              : 'linear-gradient(90deg,transparent 20%,rgba(255,255,255,0.7) 50%,transparent 80%)',
            backgroundSize: '200% 100%',
            animation: `${thumbShimmer} 1.4s ease-in-out infinite`,
          },
        }} />
      )}

      {!showPlaceholder ? (
        <img
          src={frameUrl}
          alt={caption}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoading(false)}
          onError={() => { setImgError(true); setImgLoading(false) }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoading ? 0 : 1, transition: 'opacity 0.2s' }}
        />
      ) : (
        <Box sx={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0.5, p: 0.75,
        }}>
          {type === 'video'
            ? <PlayCircleOutlineIcon sx={{ fontSize: 22, color: theme.palette.text.secondary, opacity: 0.7 }} />
            : <ZenithLogo sx={{ fontSize: 18, color: theme.palette.text.secondary, opacity: 0.35 }} />
          }
          <Typography sx={{
            fontSize: 10, color: theme.palette.text.secondary, opacity: 0.7,
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
        <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700, lineHeight: 1 }}>
          {frameIndex + 1}
        </Typography>
      </Box>

      {/* Active indicator overlay */}
      {isActive && (
        <Box sx={{
          position: 'absolute', inset: 0,
          boxShadow: `inset 0 0 0 2px ${neutralBorderStrong(isDark)}`,
          borderRadius: '6px',
          pointerEvents: 'none',
        }} />
      )}
    </Box>
  )
}

export default memo(FrameThumbnail, (prev, next) =>
  prev.getFrameUrl          === next.getFrameUrl          &&
  prev.frameIndex           === next.frameIndex           &&
  prev.caption              === next.caption              &&
  prev.type                 === next.type                 &&
  prev.isActive             === next.isActive             &&
  prev.onClick              === next.onClick              &&
  prev.role                 === next.role                 &&
  prev['aria-selected']     === next['aria-selected']
)
