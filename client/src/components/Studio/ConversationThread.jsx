import { useState } from 'react'
import { Box, Typography, Button, CircularProgress, useTheme } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ErrorBoundary from '../error/ErrorBoundary'
import SessionView from './SessionView'
import LoadingView from './LoadingView'
import NotesPanel from './NotesPanel'
import { isTextTurn } from './studioUtils'
import { BRAND, PALETTE } from '../../theme/tokens.js'
import BlockRenderer from '../Interactive/BlockRenderer'

function ContentColumn({ children }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3 }}>
      {children}
    </Box>
  )
}

// Exported so Studio.jsx can reuse it for the bootstrap prompt display.
export function UserBubble({ prompt }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 3.5 }}>
      <Box sx={{
        maxWidth: '72%', px: 2.5, py: 1.5,
        backgroundColor: isDark ? PALETTE.darkSubsurface : PALETTE.warmSand,
        color: theme.palette.text.primary,
        borderRadius: '18px 18px 4px 18px',
        fontSize: 14.5, fontWeight: 400, lineHeight: 1.6,
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderWarm}`,
      }}>
        {prompt}
      </Box>
    </Box>
  )
}

function RetryBanner({ turn, onRetry }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetryClick = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try { await onRetry(turn) } finally { setIsRetrying(false) }
  }

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
        disabled={isRetrying}
        startIcon={isRetrying ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon sx={{ fontSize: 14 }} />}
        onClick={handleRetryClick}
        sx={{
          textTransform: 'none', fontSize: 12.5, fontWeight: 600,
          borderRadius: '8px', flexShrink: 0,
          color: theme.palette.primary.main,
          border: `1px solid ${theme.palette.primary.main}44`,
          '&:hover': { bgcolor: isDark ? 'rgba(75,114,255,0.10)' : `${BRAND.primary}0d` },
        }}
      >
        {isRetrying ? 'Retrying…' : 'Retry'}
      </Button>
    </Box>
  )
}

function TurnView({ turn, onPauseAsk, onRetryTurn, onRetryGeneration }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box data-turn-id={turn.tempId} sx={{ mb: 4, '&:last-child': { mb: 0 } }}>
      <ContentColumn>
        <UserBubble prompt={turn.prompt} />

        {turn.render_path === 'interactive' ? (
          // ── Interactive mode ──────────────────────────────────────────────
          (turn.title || (turn.blocks ?? []).length > 0) ? (
            <BlockRenderer
              title={turn.title}
              blocks={turn.blocks ?? []}
              isLoading={turn.isLoading}
            />
          ) : (
            <LoadingView stage={turn.stage || 'planning'} compact mode="interactive" />
          )
        ) : turn.isLoading ? (
          // ── Video mode: in-progress ────────────────────────────────────────
          <LoadingView stage={turn.stage || 'planning'} compact textMode={turn.videoPhase === 'disabled'} />
        ) : turn.videoPhase === 'error' && !turn.id ? (
          <Box sx={{
            py: 2.5, px: 3, borderRadius: '12px',
            backgroundColor: isDark ? '#1a1a1a' : '#fff8f8',
            border: `1px solid ${theme.palette.error.main}22`,
          }}>
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.5, mb: 1.5 }}>
              We couldn't generate a response this time. Please try asking again.
            </Typography>
            <RetryBanner turn={turn} onRetry={onRetryGeneration} />
          </Box>
        ) : turn.id && turn.videoPhase === 'generating' ? (
          <LoadingView stage="video" compact framesData={{ sessionId: turn.id, framesData: turn.framesData }} />
        ) : turn.id && turn.videoPhase === 'error' ? (
          <>
            {turn.framesData && (
              <SessionView session={turn} videoPhase="error" framesData={turn.framesData} onPauseAsk={onPauseAsk} />
            )}
            <Box sx={{ mt: turn.framesData ? 1.5 : 0 }}>
              <RetryBanner turn={turn} onRetry={onRetryTurn} />
            </Box>
          </>
        ) : turn.id && isTextTurn(turn) ? (
          <NotesPanel notes={turn.framesData?.notes} />
        ) : turn.id ? (
          <SessionView session={turn} videoPhase={turn.videoPhase} framesData={turn.framesData} onPauseAsk={onPauseAsk} />
        ) : null}
      </ContentColumn>
    </Box>
  )
}

function TurnWithBoundary({ turn, onPauseAsk, onRetryTurn, onRetryGeneration }) {
  return (
    <ErrorBoundary level="component" key={`${turn.tempId}-boundary`}>
      <TurnView turn={turn} onPauseAsk={onPauseAsk} onRetryTurn={onRetryTurn} onRetryGeneration={onRetryGeneration} />
    </ErrorBoundary>
  )
}

export default function ConversationThread({ turns, onPauseAsk, onRetryTurn, onRetryGeneration }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pt: 1, pb: 1 }}>
      {turns.map((turn) => (
        <TurnWithBoundary key={turn.tempId} turn={turn} onPauseAsk={onPauseAsk} onRetryTurn={onRetryTurn} onRetryGeneration={onRetryGeneration} />
      ))}
    </Box>
  )
}
