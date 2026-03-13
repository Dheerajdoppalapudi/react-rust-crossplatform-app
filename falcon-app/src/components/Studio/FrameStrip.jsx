import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material'
import FrameThumbnail from './FrameThumbnail'
import { getFrameType } from './constants'

export default function FrameStrip({ sessionId, framesData, activeFrame, onFrameClick }) {
  const theme = useTheme()
  if (!framesData?.captions?.length) return null

  const { images = [], captions } = framesData

  return (
    <Box sx={{
      px: 3, pt: 1.5, pb: 2,
      borderTop: `1px solid ${theme.palette.divider}`,
      bgcolor: 'background.paper',
      flexShrink: 0,
    }}>
      <Typography sx={{
        fontSize: 10, fontWeight: 600,
        color: theme.palette.text.secondary,
        opacity: 0.55, textTransform: 'uppercase',
        letterSpacing: '0.6px', mb: 1,
      }}>
        Frames · {captions.length}
      </Typography>

      <Box sx={{
        display: 'flex', gap: 1.5,
        overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
      }}>
        {captions.map((caption, i) => (
          <FrameThumbnail
            key={i}
            sessionId={sessionId}
            frameIndex={i}
            caption={caption}
            type={getFrameType(images[i])}
            isActive={activeFrame === i}
            onClick={() => onFrameClick(i)}
          />
        ))}
      </Box>
    </Box>
  )
}
