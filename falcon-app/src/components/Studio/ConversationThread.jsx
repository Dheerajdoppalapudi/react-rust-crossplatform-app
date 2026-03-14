import { Box, Typography, Divider, useTheme } from '@mui/material'
import SessionView from './SessionView'
import LoadingView from './LoadingView'

// ─── User question bubble ──────────────────────────────────────────────────────
function UserBubble({ prompt }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, pt: 3, pb: 1.5 }}>
      <Box sx={{
        maxWidth: '68%',
        px: 2.5, py: 1.5,
        backgroundColor: isDark ? '#242424' : '#f1f5f9',
        color: theme.palette.text.primary,
        borderRadius: '18px 18px 4px 18px',
        fontSize: 14.5,
        fontWeight: 400,
        lineHeight: 1.6,
        border: `1px solid ${isDark ? '#2e2e2e' : '#e2e8f0'}`,
      }}>
        {prompt}
      </Box>
    </Box>
  )
}

// ─── Single turn ───────────────────────────────────────────────────────────────
function TurnView({ turn, onPauseAsk }) {
  const theme = useTheme()

  return (
    <Box>
      <UserBubble prompt={turn.prompt} />

      {/* AI response */}
      <Box sx={{ px: 3, pb: 3 }}>
        {turn.isLoading ? (
          <LoadingView stage={turn.stage || 'planning'} compact />
        ) : turn.id ? (
          <SessionView
            session={turn}
            videoPhase={turn.videoPhase}
            framesData={turn.framesData}
            hideHeader
            onPauseAsk={onPauseAsk}
          />
        ) : (
          <Box sx={{
            px: 3, py: 2.5, borderRadius: '12px',
            backgroundColor: isDark => isDark ? '#1a1a1a' : '#fff8f8',
            border: `1px solid ${theme.palette.error.main}22`,
          }}>
            <Typography sx={{ fontSize: 13, color: theme.palette.error.main, opacity: 0.7 }}>
              Something went wrong generating this response.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Full conversation thread ──────────────────────────────────────────────────
export default function ConversationThread({ turns, onPauseAsk }) {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pb: 2 }}>
      {turns.map((turn, idx) => (
        <Box key={turn.tempId || turn.id || idx}>
          <TurnView turn={turn} onPauseAsk={onPauseAsk} />
          {idx < turns.length - 1 && (
            <Divider sx={{ mx: 3, borderColor: theme.palette.divider, opacity: 0.5 }} />
          )}
        </Box>
      ))}
    </Box>
  )
}
