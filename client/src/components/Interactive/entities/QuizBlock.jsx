import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

export default function QuizBlock({
  question     = '',
  type         = 'mcq',
  options      = [],
  correctIndex = 0,
  explanation,
  hint,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [selected,    setSelected]    = useState(null)
  const [revealed,    setRevealied]   = useState(false)
  const [hintVisible, setHintVisible] = useState(false)

  const displayOptions = type === 'true_false' ? ['True', 'False'] : options

  function handleSelect(i) {
    if (revealed) return
    setSelected(i)
    setRevealied(true)
  }

  function optionStyle(i) {
    const base = {
      display: 'flex', alignItems: 'center', gap: 1,
      px: 2, py: 1.25,
      borderRadius: `${RADIUS.md}px`,
      border: '2px solid',
      cursor: revealed ? 'default' : 'pointer',
      userSelect: 'none',
      transition: 'all 0.18s ease',
      fontSize: TYPOGRAPHY.sizes.bodySm,
    }

    if (!revealed) {
      return {
        ...base,
        borderColor: isDark ? PALETTE.borderDark : PALETTE.borderCream,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        '&:hover': {
          borderColor: isDark ? 'rgba(75,114,255,0.5)' : 'rgba(75,114,255,0.4)',
          backgroundColor: isDark ? 'rgba(75,114,255,0.08)' : 'rgba(75,114,255,0.05)',
        },
      }
    }

    if (i === correctIndex) {
      return {
        ...base,
        borderColor: '#2ea043',
        backgroundColor: isDark ? 'rgba(46,160,67,0.12)' : 'rgba(46,160,67,0.08)',
      }
    }
    if (i === selected && i !== correctIndex) {
      return {
        ...base,
        borderColor: '#f85149',
        backgroundColor: isDark ? 'rgba(248,81,73,0.12)' : 'rgba(248,81,73,0.08)',
      }
    }
    return {
      ...base,
      opacity: 0.45,
      borderColor: isDark ? PALETTE.borderDark : PALETTE.borderCream,
      backgroundColor: 'transparent',
    }
  }

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: `${RADIUS.lg}px`,
        p: 2.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        {/* Question */}
        <Typography sx={{
          fontSize: TYPOGRAPHY.sizes.body,
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
          mb: 2,
          lineHeight: 1.5,
        }}>
          {question}
        </Typography>

        {/* Hint (before reveal only) */}
        {hint && !revealed && (
          <Box sx={{ mb: 1.5 }}>
            {!hintVisible ? (
              <Typography
                component="span"
                onClick={() => setHintVisible(true)}
                sx={{
                  fontSize: TYPOGRAPHY.sizes.caption,
                  color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  '&:hover': { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' },
                }}
              >
                💡 Show hint
              </Typography>
            ) : (
              <Typography sx={{
                fontSize: TYPOGRAPHY.sizes.caption,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontStyle: 'italic',
              }}>
                {hint}
              </Typography>
            )}
          </Box>
        )}

        {/* Options */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {displayOptions.map((opt, i) => (
            <Box key={i} onClick={() => handleSelect(i)} sx={optionStyle(i)}>
              {revealed && i === correctIndex && (
                <Typography component="span" sx={{ color: '#2ea043', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>✓</Typography>
              )}
              {revealed && i === selected && i !== correctIndex && (
                <Typography component="span" sx={{ color: '#f85149', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>✗</Typography>
              )}
              {(!revealed || (i !== correctIndex && i !== selected)) && (
                <Typography component="span" sx={{
                  minWidth: 20, height: 20, borderRadius: '50%',
                  border: '1.5px solid', flexShrink: 0,
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                }}>
                  {String.fromCharCode(65 + i)}
                </Typography>
              )}
              <Typography sx={{
                fontSize: TYPOGRAPHY.sizes.bodySm,
                color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                lineHeight: 1.4,
              }}>
                {opt}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Explanation (after reveal) */}
        {revealed && explanation && (
          <Box sx={{
            mt: 2, p: 1.5,
            borderRadius: `${RADIUS.md}px`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderLeft: `3px solid ${selected === correctIndex ? '#2ea043' : '#f85149'}`,
          }}>
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
              lineHeight: 1.5,
            }}>
              {explanation}
            </Typography>
          </Box>
        )}
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
