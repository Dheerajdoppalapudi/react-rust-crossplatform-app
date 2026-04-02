import { Box, Typography, useTheme } from '@mui/material'
import SessionView from './SessionView'
import LoadingView from './LoadingView'

// ─── User question bubble ──────────────────────────────────────────────────────
// Shared centered content column — matches how Claude/ChatGPT constrain width
function ContentColumn({ children }) {
  return (
    <Box sx={{
      width: '100%',
      maxWidth: 760,
      mx: 'auto',
      px: 3,
    }}>
      {children}
    </Box>
  )
}

function UserBubble({ prompt }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 3.5 }}>
      <Box sx={{
        maxWidth: '72%',
        px: 2.5, py: 1.5,
        backgroundColor: isDark ? '#242424' : '#f1f5f9',
        color: theme.palette.text.primary,
        borderRadius: '18px 18px 4px 18px',
        fontSize: 14.5, fontWeight: 400, lineHeight: 1.6,
        border: `1px solid ${isDark ? '#2e2e2e' : '#e2e8f0'}`,
      }}>
        {prompt}
      </Box>
    </Box>
  )
}

// ─── Single turn ───────────────────────────────────────────────────────────────
function TurnView({ turn, onPauseAsk }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ mb: 4 }}>
      <ContentColumn>
        <UserBubble prompt={turn.prompt} />

        {turn.isLoading ? (
          <LoadingView stage={turn.stage || 'planning'} compact />
        ) : turn.id && turn.videoPhase === 'generating' ? (
          /* Video still rendering — continue the chain at the video step */
          <LoadingView
            stage="video"
            compact
            framesData={{ sessionId: turn.id, framesData: turn.framesData }}
          />
        ) : turn.id ? (
          <SessionView
            session={turn}
            videoPhase={turn.videoPhase}
            framesData={turn.framesData}
            onPauseAsk={onPauseAsk}
          />
        ) : (
          <Box sx={{
            py: 2.5, px: 3, borderRadius: '12px',
            backgroundColor: isDark ? '#1a1a1a' : '#fff8f8',
            border: `1px solid ${theme.palette.error.main}22`,
          }}>
            <Typography sx={{ fontSize: 13, color: theme.palette.error.main, opacity: 0.7 }}>
              Something went wrong generating this response.
            </Typography>
          </Box>
        )}
      </ContentColumn>
    </Box>
  )
}

// ─── Full conversation thread ──────────────────────────────────────────────────
export default function ConversationThread({ turns, onPauseAsk }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pt: 1, pb: 1 }}>
      {turns.map((turn, idx) => (
        <TurnView key={turn.tempId || turn.id || idx} turn={turn} onPauseAsk={onPauseAsk} />
      ))}
    </Box>
  )
}
