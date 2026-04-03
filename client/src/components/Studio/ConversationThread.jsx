import { Box, Typography, Button, useTheme } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ErrorBoundary from '../error/ErrorBoundary'
import SessionView from './SessionView'
import LoadingView from './LoadingView'

// ─── Centered content column — matches PromptBar max-width ────────────────────
function ContentColumn({ children }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3 }}>
      {children}
    </Box>
  )
}

// ─── User prompt bubble ───────────────────────────────────────────────────────
// Exported so Studio.jsx can reuse it for the bootstrap (first-turn) prompt display.
export function UserBubble({ prompt }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 3.5 }}>
      <Box sx={{
        maxWidth: '72%', px: 2.5, py: 1.5,
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

// ─── Video retry banner ───────────────────────────────────────────────────────
function RetryBanner({ turn, onRetry }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 2, px: 2.5, borderRadius: '12px',
      backgroundColor: isDark ? 'rgba(255,59,59,0.06)' : '#fff5f5',
      border: `1px solid ${isDark ? 'rgba(255,59,59,0.2)' : '#fecaca'}`,
    }}>
      <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, flex: 1, lineHeight: 1.5 }}>
        Video generation didn't complete. This is usually a temporary issue.
      </Typography>
      <Button
        size="small"
        startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
        onClick={() => onRetry(turn)}
        sx={{
          textTransform: 'none', fontSize: 12.5, fontWeight: 600,
          borderRadius: '8px', flexShrink: 0,
          color: theme.palette.primary.main,
          border: `1px solid ${theme.palette.primary.main}44`,
          '&:hover': { bgcolor: isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff' },
        }}
      >
        Retry
      </Button>
    </Box>
  )
}

// ─── Single conversation turn ─────────────────────────────────────────────────
function TurnView({ turn, onPauseAsk, onRetryTurn }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ mb: 4, '&:last-child': { mb: 0 } }}>
      <ContentColumn>
        <UserBubble prompt={turn.prompt} />

        {turn.isLoading ? (
          <LoadingView stage={turn.stage || 'planning'} compact />
        ) : turn.videoPhase === 'error' && !turn.id ? (
          /* Complete generation failure */
          <Box sx={{
            py: 2.5, px: 3, borderRadius: '12px',
            backgroundColor: isDark ? '#1a1a1a' : '#fff8f8',
            border: `1px solid ${theme.palette.error.main}22`,
          }}>
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.5 }}>
              We couldn't generate a response this time. Please try asking again.
            </Typography>
          </Box>
        ) : turn.id && turn.videoPhase === 'generating' ? (
          <LoadingView
            stage="video"
            compact
            framesData={{ sessionId: turn.id, framesData: turn.framesData }}
          />
        ) : turn.id && turn.videoPhase === 'error' ? (
          /* Video generation failed — frames may still be present */
          <>
            {turn.framesData && (
              <SessionView
                session={turn}
                videoPhase="error"
                framesData={turn.framesData}
                onPauseAsk={onPauseAsk}
              />
            )}
            <Box sx={{ mt: turn.framesData ? 1.5 : 0 }}>
              <RetryBanner turn={turn} onRetry={onRetryTurn} />
            </Box>
          </>
        ) : turn.id ? (
          <SessionView
            session={turn}
            videoPhase={turn.videoPhase}
            framesData={turn.framesData}
            onPauseAsk={onPauseAsk}
          />
        ) : null}
      </ContentColumn>
    </Box>
  )
}

// ─── Wrapped turn — isolated error boundary per turn ─────────────────────────
function TurnWithBoundary({ turn, onPauseAsk, onRetryTurn }) {
  return (
    <ErrorBoundary
      level="component"
      // Stable key — error recovery here is state-based (videoPhase), not ErrorBoundary-based.
      // The boundary protects against unexpected render exceptions thrown by child components.
      key={`${turn.tempId}-boundary`}
    >
      <TurnView turn={turn} onPauseAsk={onPauseAsk} onRetryTurn={onRetryTurn} />
    </ErrorBoundary>
  )
}

// ─── Full conversation thread ──────────────────────────────────────────────────
export default function ConversationThread({ turns, onPauseAsk, onRetryTurn }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pt: 1, pb: 1 }}>
      {turns.map((turn) => (
        // tempId is stable for both in-flight and loaded turns
        <TurnWithBoundary
          key={turn.tempId}
          turn={turn}
          onPauseAsk={onPauseAsk}
          onRetryTurn={onRetryTurn}
        />
      ))}
    </Box>
  )
}
