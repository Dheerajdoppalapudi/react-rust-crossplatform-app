import { Box, Typography, useTheme } from '@mui/material'
import PromptBar      from './PromptBar'
import SuggestionBoxes from './SuggestionBoxes'
import ParalyteLogo from '../common/ParalyteLogo'
import { PALETTE } from '../../theme/tokens.js'
import { useIsDark } from '../../hooks/useIsDark.js'

export default function EmptyView({ onSuggestionClick, ...promptBarProps }) {
  const theme  = useTheme()
  const isDark = useIsDark()

  return (
    <Box sx={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      px:             { xs: 2, sm: 4 },
      py:             6,
      minHeight:      0,
    }}>

      {/* Title */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 0.5 }}>
          <ParalyteLogo sx={{ fontSize: { xs: 34, sm: 42 }, color: theme.palette.text.primary }} />
          <Typography sx={{
            fontSize:      { xs: 26, sm: 32 },
            fontWeight:    600,
            lineHeight:    1.15,
            color:         theme.palette.text.primary,
            letterSpacing: '-0.02em',
          }}>
            What do you want to learn?
          </Typography>
        </Box>
        <Typography sx={{
          mt:         1.5,
          fontSize:   15,
          color:      isDark ? PALETTE.stoneGray : PALETTE.oliveGray,
          lineHeight: 1.6,
        }}>
          Type a topic and Paralyte generates a visual lesson.
        </Typography>
      </Box>

      {/* Prompt bar — centered, embedded so its card aligns with suggestion grid */}
      <Box sx={{ width: '100%', maxWidth: 680, mb: 4 }}>
        <PromptBar embedded {...promptBarProps} />
      </Box>

      {/* Suggestions */}
      <Box sx={{ width: '100%', maxWidth: 680 }}>
        <SuggestionBoxes onSuggestionClick={onSuggestionClick} />
      </Box>

    </Box>
  )
}
