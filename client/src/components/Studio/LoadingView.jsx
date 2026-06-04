import { useState } from 'react'
import { Box, Typography, Collapse } from '@mui/material'
import { useIsDark } from '../../hooks/useIsDark'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import KeyboardArrowDownIcon  from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon    from '@mui/icons-material/KeyboardArrowUp'
import { paralyteSpin }        from '../../theme/animations'
import ParalyteLogo            from '../common/ParalyteLogo'
import { metaText }           from '../../theme/styleUtils'
import { StageRow, EntityChipsBar } from './LoadingStageRow'

// ── Paralyte logo spinner ─────────────────────────────────────────────────────

function ParalyteSpinner() {
  return (
    <Box sx={{ display: 'flex', mt: 2.5, mb: 0.5, pl: '2px' }}>
      <ParalyteLogo sx={{
        fontSize: 28,
        color: 'text.secondary',
        animation: `${paralyteSpin} 1.5s ease-in-out infinite`,
      }} />
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoadingView({
  stages           = null,
  stage            = null,
  compact          = false,
  sources          = [],
  defaultOpen      = true,
  beatTitles       = null,
  completedBeats   = null,
  selectedEntities = [],
  blockCount       = 0,
  active           = false,   // turn is still streaming — keep the spinner up
}) {
  const isDark = useIsDark()

  // 'designing' is a generate.py wrapper that spans the entire interactive pipeline —
  // now redundant since widgets/planning/building_* sub-stages provide granular feedback.
  const displayStages = (stages?.length ? stages.filter(s => s.id !== 'designing') : null)
    ?? [{ id: stage ?? 'planning', label: 'Planning…', status: 'active' }]

  const allDone   = displayStages.length >= 2 && displayStages.every(s => s.status === 'done')
  const doneCount = displayStages.filter(s => s.status === 'done').length
  const [masterOpen, setMasterOpen] = useState(defaultOpen)

  // While the turn is still streaming (`active`), never collapse to the
  // "Completed N steps" summary and never drop the spinner — even in the brief
  // gap after one stage finishes and before the next event arrives. This is what
  // removes the spinner flicker between, e.g., "Reading sources" and the next stage.
  const showCompletedHeader = allDone && !active
  const showSpinner         = active || (!allDone && displayStages.some(s => s.status === 'active'))

  const subduedColor = metaText(isDark)

  return (
    <Box
      role="status" aria-live="polite" aria-atomic="true"
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        py: compact ? 1 : 2,
        minHeight: compact ? 40 : 60,
        width: '100%',
      }}
    >
      {/* Screen-reader live region */}
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {displayStages.find(s => s.status === 'active')?.label ?? 'Complete'}
      </Box>

      {/* "Completed N steps" collapsible header */}
      {showCompletedHeader && (
        <Box
          onClick={() => setMasterOpen(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            mb: masterOpen ? 1.5 : 0,
            cursor: 'pointer', userSelect: 'none',
            '&:hover': { opacity: 0.75 },
            transition: 'opacity 0.15s',
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 13, color: subduedColor }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: subduedColor }}>
            Completed {doneCount} step{doneCount !== 1 ? 's' : ''}
          </Typography>
          {masterOpen
            ? <KeyboardArrowUpIcon   sx={{ fontSize: 13, color: subduedColor }} />
            : <KeyboardArrowDownIcon sx={{ fontSize: 13, color: subduedColor }} />
          }
        </Box>
      )}

      {/* Stage list */}
      <Collapse in={!showCompletedHeader || masterOpen} timeout={220}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {displayStages.map((s, i) => (
            <StageRow
              key={s.id}
              stage={s}
              sources={sources}
              isLast={i === displayStages.length - 1}
              compact={compact}
              isDark={isDark}
              beatTitles={beatTitles}
              completedBeats={completedBeats}
              blockCount={blockCount}
            />
          ))}
        </Box>

        <EntityChipsBar entities={selectedEntities} isDark={isDark} />
      </Collapse>

      {/* Paralyte spinner — stays up for the whole streaming phase (no flicker) */}
      {showSpinner && <ParalyteSpinner />}
    </Box>
  )
}
