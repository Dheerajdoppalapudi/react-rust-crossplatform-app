import ReactMarkdown from 'react-markdown'
import { Box, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../theme/tokens.js'

export default function MarkdownText({ content, sx = {} }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  if (!content) return null

  return (
    <Box sx={{
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize:   TYPOGRAPHY.sizes.bodySm,
      lineHeight: TYPOGRAPHY.lineHeights.relaxed,
      color: 'text.secondary',

      '& p':            { mt: 0, mb: 1.5 },
      '& p:last-child': { mb: 0 },
      '& strong':       { fontWeight: TYPOGRAPHY.weights.semibold, color: 'text.primary' },
      '& em':           { fontStyle: 'italic' },
      '& ul, & ol':     { pl: 3, mb: 1.5, mt: 0 },
      '& li':           { mb: 0.5 },
      '& code': {
        fontFamily: TYPOGRAPHY.fontFamilyMono,
        fontSize:   TYPOGRAPHY.sizes.caption,
        px: 0.75, py: 0.25,
        borderRadius: `${RADIUS.sharp}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      },
      '& pre': {
        overflow: 'auto',
        p: 2, mb: 1.5, mt: 0,
        borderRadius: `${RADIUS.md}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        '& code': { backgroundColor: 'transparent', p: 0 },
      },
      '& h1, & h2, & h3': {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontWeight: TYPOGRAPHY.weights.semibold,
        color: 'text.primary',
        mt: 2, mb: 1,
        lineHeight: TYPOGRAPHY.lineHeights.snug,
      },
      ...sx,
    }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  )
}
