import { useState, useRef, memo } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, Button, CircularProgress, useTheme } from '@mui/material'
import { withProfiler } from '../../lib/sentry.js'
import RefreshIcon from '@mui/icons-material/Refresh'
import ErrorBoundary from '../error/ErrorBoundary'
import SessionView from './SessionView'
import LoadingView from './LoadingView'
import VideoAssemblingView from './VideoAssemblingView'
import NotesPanel from './NotesPanel'
import TextSelectionPopup from './TextSelectionPopup'
import { isTextTurn } from './studioUtils'
import { PALETTE } from '../../theme/tokens.js'
import BlockRenderer   from '../Interactive/BlockRenderer'
import ResearchResult  from './ResearchResult'

// Exported so Studio.jsx can reuse it for the bootstrap prompt display.
export function UserBubble({ prompt }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2.5, pb: 2 }}>
      <Box sx={{
        maxWidth: '72%', minWidth: 60, px: 2.5, py: 1.5,
        backgroundColor: isDark ? PALETTE.darkSubsurface : PALETTE.warmSand,
        color: theme.palette.text.primary,
        borderRadius: '18px 18px 4px 18px',
        fontSize: 14.5, fontWeight: 400, lineHeight: 1.6,
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
      }}>
        {prompt}
      </Box>
    </Box>
  )
}

// Shared inline "something failed — retry" banner. `busy` shows a spinner while
// an async retry is in flight; pass `message` for the body copy.
function InlineErrorBanner({ message, retryLabel = 'Retry', onRetry, busy = false, sx }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 2, px: 2.5, borderRadius: '12px',
      backgroundColor: isDark ? 'rgba(255,59,59,0.06)' : '#fff5f5',
      border: `1px solid ${isDark ? 'rgba(255,59,59,0.2)' : '#fecaca'}`,
      ...sx,
    }}>
      <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, flex: 1, lineHeight: 1.5 }}>
        {message}
      </Typography>
      <Button
        size="small"
        disabled={busy}
        startIcon={busy ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon sx={{ fontSize: 14 }} />}
        onClick={onRetry}
        sx={{
          textTransform: 'none', fontSize: 12.5, fontWeight: 600,
          borderRadius: '8px', flexShrink: 0,
          color: theme.palette.text.secondary,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: theme.palette.text.primary },
        }}
      >
        {busy ? 'Retrying…' : retryLabel}
      </Button>
    </Box>
  )
}

// Video-retry banner with its own in-flight state (the retry is awaited).
function RetryBanner({ turn, onRetry }) {
  const [isRetrying, setIsRetrying] = useState(false)
  const handleRetryClick = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try { await onRetry(turn) } finally { setIsRetrying(false) }
  }
  return (
    <InlineErrorBanner
      message="Video generation didn't complete. This is usually a temporary issue."
      onRetry={handleRetryClick}
      busy={isRetrying}
    />
  )
}

// Shared LoadingView config for a turn that is still streaming its content.
function TurnLoadingView({ turn }) {
  return (
    <LoadingView
      stages={turn.stages}
      sources={turn.sources ?? []}
      compact
      synthesisText={turn.synthesisText}
      beatTitles={turn.beatTitles}
      completedBeats={turn.completedBeats}
      selectedEntities={turn.selectedEntities ?? []}
      blockCount={turn.blockCount ?? 0}
    />
  )
}

// Decides what a turn renders below its prompt + stage timeline. One branch per
// distinct state, top to bottom, so the control flow reads linearly.
function TurnContent({ turn, onPauseAsk, onRetryTurn, onRetryGeneration, notesEnabled }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // ── Interactive turns: research answer, lesson blocks, or still designing ──
  if (turn.render_path === 'interactive') {
    const blocks     = turn.blocks ?? []
    const sources    = turn.sources ?? []
    const hasContent = turn.title || blocks.length > 0 || turn.synthesisText || (!turn.isLoading && sources.length > 0)

    if (!hasContent) return <TurnLoadingView turn={turn} />

    if (turn.synthesisText || sources.length > 0) {
      return (
        <ResearchResult
          turnId={turn.tempId}
          prompt={turn.prompt ?? ''}
          synthesisText={turn.synthesisText ?? ''}
          synthesisComplete={turn.synthesisComplete ?? false}
          sources={sources}
          blocks={blocks}
          title={turn.title ?? ''}
          learningObjective={turn.learningObjective ?? null}
          isLoading={turn.isLoading}
        />
      )
    }

    return (
      <BlockRenderer
        turnId={turn.tempId}
        title={turn.title}
        learningObjective={turn.learningObjective}
        blocks={blocks}
        isLoading={turn.isLoading}
      />
    )
  }

  // ── Video turns ───────────────────────────────────────────────────────────
  if (turn.isLoading) return <TurnLoadingView turn={turn} />

  // Failed before the server ever returned a session id — offer a full re-run.
  if (turn.videoPhase === 'error' && !turn.id) {
    return (
      <Box sx={{
        py: 2.5, px: 3, borderRadius: '12px',
        backgroundColor: isDark ? PALETTE.darkSurface : PALETTE.parchment,
        border: `1px solid ${theme.palette.error.main}22`,
      }}>
        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.5, mb: 1.5 }}>
          We couldn't generate a response this time. Please try asking again.
        </Typography>
        <RetryBanner turn={turn} onRetry={onRetryGeneration} />
      </Box>
    )
  }

  if (turn.id && turn.videoPhase === 'generating') return <VideoAssemblingView turn={turn} />

  // Frames exist but video assembly failed — show frames + a retry for the video.
  if (turn.id && turn.videoPhase === 'error') {
    return (
      <>
        {turn.framesData && (
          <SessionView session={turn} videoPhase="error" framesData={turn.framesData} onPauseAsk={onPauseAsk} notesEnabled={notesEnabled} />
        )}
        <Box sx={{ mt: turn.framesData ? 1.5 : 0 }}>
          <RetryBanner turn={turn} onRetry={onRetryTurn} />
        </Box>
      </>
    )
  }

  if (turn.id && isTextTurn(turn)) return notesEnabled ? <NotesPanel notes={turn.framesData?.notes} /> : null

  if (turn.id) {
    return <SessionView session={turn} videoPhase={turn.videoPhase} framesData={turn.framesData} onPauseAsk={onPauseAsk} notesEnabled={notesEnabled} />
  }

  return null
}

const TurnView = memo(function TurnView({ turn, onPauseAsk, onRetryTurn, onRetryGeneration, notesEnabled, registerTurnRef }) {
  // The collapsed stage timeline shows once a turn has content (or finished) and
  // ran at least two stages — i.e. there's a meaningful history worth keeping.
  const showStageTimeline =
    ((turn.blocks?.length ?? 0) > 0 || !turn.isLoading) && (turn.stages?.length ?? 0) >= 2

  // An interactive turn that errored before producing any content.
  const interactiveFailed =
    turn.generationFailed && turn.render_path === 'interactive' &&
    !turn.title && !(turn.blocks ?? []).length && !turn.synthesisText

  return (
    <Box
      ref={registerTurnRef ? (el) => registerTurnRef(turn.tempId, el) : undefined}
      data-turn-id={turn.tempId}
      sx={{ mb: 2, '&:last-child': { mb: 0 } }}
    >
      <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <UserBubble prompt={turn.prompt} />

        {showStageTimeline && (
          <LoadingView
            stages={turn.stages}
            sources={turn.sources ?? []}
            compact
            defaultOpen={turn.isLoading}
            selectedEntities={turn.selectedEntities ?? []}
          />
        )}

        {interactiveFailed && (
          <InlineErrorBanner
            message="Generation failed — this is usually temporary."
            onRetry={() => onRetryGeneration(turn)}
            sx={{ mt: 0.5 }}
          />
        )}

        <TurnContent
          turn={turn}
          onPauseAsk={onPauseAsk}
          onRetryTurn={onRetryTurn}
          onRetryGeneration={onRetryGeneration}
          notesEnabled={notesEnabled}
        />
      </Box>
    </Box>
  )
})

const TurnWithBoundary = memo(function TurnWithBoundary({ turn, onPauseAsk, onRetryTurn, onRetryGeneration, notesEnabled, registerTurnRef }) {
  return (
    <ErrorBoundary level="component" key={`${turn.tempId}-boundary`}>
      <TurnView turn={turn} onPauseAsk={onPauseAsk} onRetryTurn={onRetryTurn} onRetryGeneration={onRetryGeneration} notesEnabled={notesEnabled} registerTurnRef={registerTurnRef} />
    </ErrorBoundary>
  )
})

const ConversationThread = memo(function ConversationThread({ turns, onPauseAsk, onRetryTurn, onRetryGeneration, notesEnabled, onTextSelect, registerTurnRef }) {
  const containerRef = useRef(null)

  return (
    <Box ref={containerRef} sx={{ width: '100%', display: 'flex', flexDirection: 'column', pt: 1, pb: 1, position: 'relative' }}>
      {turns.map((turn) => (
        <TurnWithBoundary key={turn.tempId} turn={turn} onPauseAsk={onPauseAsk} onRetryTurn={onRetryTurn} onRetryGeneration={onRetryGeneration} notesEnabled={notesEnabled} registerTurnRef={registerTurnRef} />
      ))}
      {onTextSelect && (
        <TextSelectionPopup containerRef={containerRef} onAskFollowUp={onTextSelect} />
      )}
    </Box>
  )
})

const turnShape = PropTypes.shape({
  tempId:          PropTypes.string.isRequired,
  id:              PropTypes.string,
  prompt:          PropTypes.string.isRequired,
  isLoading:       PropTypes.bool,
  stage:           PropTypes.string,
  videoPhase:      PropTypes.string,
  render_path:     PropTypes.string,
  title:           PropTypes.string,
  learningObjective: PropTypes.string,
  blocks:          PropTypes.array,
  framesData:      PropTypes.object,
})

UserBubble.propTypes = { prompt: PropTypes.string.isRequired }

ConversationThread.propTypes = {
  turns:              PropTypes.arrayOf(turnShape).isRequired,
  onPauseAsk:         PropTypes.func.isRequired,
  onRetryTurn:        PropTypes.func.isRequired,
  onRetryGeneration:  PropTypes.func.isRequired,
  notesEnabled:       PropTypes.bool,
  onTextSelect:       PropTypes.func,
}

const ConversationThreadProfiled = withProfiler(ConversationThread, 'ConversationThread')
export default ConversationThreadProfiled
