import { Box, Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS } from '../../../theme/tokens'

const DOT_COLORS = ['#ff5f57', '#febc2e', '#28c840']

function TerminalBlock({ block }) {
  const lines = String(block.content ?? '').split('\n')

  if (block.type === 'command') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
        <Typography component="span" sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: '#4B72FF',
          lineHeight: TYPOGRAPHY.lineHeights.relaxed,
          flexShrink: 0,
          mt: '1px',
        }}>
          $
        </Typography>
        <Typography sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: '#e6edf3',
          lineHeight: TYPOGRAPHY.lineHeights.relaxed,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {block.content}
        </Typography>
      </Box>
    )
  }

  if (block.type === 'output') {
    return (
      <Box sx={{ mb: 0.5, pl: 1.5 }}>
        {lines.map((line, i) => (
          <Typography key={i} sx={{
            fontFamily: TYPOGRAPHY.fontFamilyMono,
            fontSize: TYPOGRAPHY.sizes.bodySm,
            color: '#8b949e',
            lineHeight: TYPOGRAPHY.lineHeights.relaxed,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {line || ' '}
          </Typography>
        ))}
      </Box>
    )
  }

  if (block.type === 'comment') {
    return (
      <Typography sx={{
        fontFamily: TYPOGRAPHY.fontFamilyMono,
        fontSize: TYPOGRAPHY.sizes.bodySm,
        color: '#6e7681',
        fontStyle: 'italic',
        lineHeight: TYPOGRAPHY.lineHeights.relaxed,
        mb: 0.5,
      }}>
        # {block.content}
      </Typography>
    )
  }

  return null
}

export default function TerminalOutput({
  blocks  = [],
  shell   = 'bash',
  title,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const titleText = title || shell

  return (
    <Box>
      <Box sx={{
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: `1px solid ${isDark ? '#1e293b' : '#374151'}`,
        backgroundColor: '#0d1117',
      }}>
        {/* Title bar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          backgroundColor: '#161b22',
          borderBottom: '1px solid #21262d',
        }}>
          <Typography sx={{
            fontFamily: TYPOGRAPHY.fontFamilyMono,
            fontSize: TYPOGRAPHY.sizes.caption,
            color: '#8b949e',
            letterSpacing: '0.02em',
          }}>
            {titleText}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.625 }}>
            {DOT_COLORS.map(c => (
              <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
            ))}
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 2 }}>
          {blocks.map((block, i) => (
            <TerminalBlock key={i} block={block} />
          ))}
        </Box>
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
