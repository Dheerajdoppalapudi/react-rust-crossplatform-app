import { Box, IconButton, Typography, LinearProgress, Tooltip, Select, MenuItem } from '@mui/material'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import SkipNextIcon     from '@mui/icons-material/SkipNext'
import PlayArrowIcon    from '@mui/icons-material/PlayArrow'
import PauseIcon        from '@mui/icons-material/Pause'
import ReplayIcon       from '@mui/icons-material/Replay'
import { PALETTE } from '../../../theme/tokens'

const SPEED_OPTIONS = [
  { label: '2s',  value: 2000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
]

/**
 * Shared playback control bar — used by StepControls (standalone card) and
 * CodeWalkthrough (footer section of a multi-part card).
 *
 * Purely presentational: all state lives in the parent. The parent passes
 * current values and callbacks; PlaybackBar only handles layout and rendering.
 *
 * Container styling is fully caller-controlled via the `sx` prop so both
 * usage patterns (bordered standalone vs. borderTop footer) work without
 * any internal branching.
 */
export default function PlaybackBar({
  // Step state (controlled)
  step,
  total,
  label        = '',
  isPlaying,
  autoInterval,
  loop         = false,
  showPlayButton = true,
  // Optional accent color override for the progress bar fill
  accentColor,
  isDark,
  // Merged onto the outer container — pass border/bg/padding from the caller
  sx,
  // Keyboard wiring — only set when the bar itself is the keyboard target
  tabIndex,
  onKeyDown,
  // Callbacks
  onPlayPause,
  onPrev,
  onNext,
  onRestart,
  onSpeedChange,
}) {
  const atStart  = step === 0
  const atEnd    = step === total - 1
  const finished = atEnd && !loop && !isPlaying && step > 0
  const progress = total > 1 ? (step / (total - 1)) * 100 : 100

  return (
    <Box
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        outline: 'none',
        // Only add focus ring when bar is a keyboard target (tabIndex is set)
        ...(tabIndex != null
          ? { '&:focus-visible': { outline: `2px solid ${PALETTE.focusBlue}`, outlineOffset: 2 } }
          : {}),
        ...sx,
      }}
    >
      {showPlayButton && (
        finished ? (
          <Tooltip title="Restart">
            <IconButton size="small" onClick={onRestart} aria-label="Restart">
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton size="small" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )
      )}

      {/* span wrapper lets Tooltip work on a disabled button */}
      <Tooltip title="Previous step">
        <span>
          <IconButton size="small" onClick={onPrev} disabled={atStart} aria-label="Previous step">
            <SkipPreviousIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          display: 'block', mb: 0.5, fontWeight: 500, fontSize: 12.5, color: 'text.primary',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3, borderRadius: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              ...(accentColor ? { backgroundColor: accentColor } : {}),
            },
          }}
        />
      </Box>

      <Typography sx={{ fontSize: 11, color: 'text.disabled', minWidth: 36, textAlign: 'right' }}>
        {step + 1}/{total}
      </Typography>

      <Tooltip title="Next step">
        <span>
          <IconButton size="small" onClick={onNext} disabled={atEnd && !loop} aria-label="Next step">
            <SkipNextIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {showPlayButton && (
        <Tooltip title="Auto-advance speed">
          <Select
            value={autoInterval}
            onChange={e => onSpeedChange(e.target.value)}
            size="small"
            variant="standard"
            disableUnderline
            aria-label="Auto-advance speed"
            sx={{
              fontSize: 11, color: 'text.disabled', minWidth: 34,
              '& .MuiSelect-select': { py: 0, px: 0.5 },
            }}
          >
            {SPEED_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
            ))}
          </Select>
        </Tooltip>
      )}
    </Box>
  )
}
