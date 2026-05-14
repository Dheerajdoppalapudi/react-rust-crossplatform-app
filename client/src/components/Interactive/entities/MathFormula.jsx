import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip, Collapse, useTheme } from '@mui/material'
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandLessIcon   from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

function renderLatex(latex, displayMode) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
      output: 'html',
    })
  } catch {
    return `<span style="color:#b53333">Invalid LaTeX: ${latex}</span>`
  }
}

function applyHighlights(html, highlights = []) {
  if (!highlights.length) return html
  let result = html
  for (const { term, color, tooltip } of highlights) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(escaped, 'g')
    const title   = tooltip ? ` title="${tooltip}"` : ''
    result = result.replace(
      pattern,
      `<span style="color:${color};font-weight:600"${title}>${term}</span>`
    )
  }
  return result
}

function FormulaDisplay({ latex, displayMode, fontSize, highlights, isDark }) {
  const html = useMemo(() => {
    const raw = renderLatex(latex, displayMode)
    return applyHighlights(raw, highlights)
  }, [latex, displayMode, highlights])

  return (
    <Box
      sx={{
        overflowX: 'auto',
        color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
        fontSize: fontSize ?? '1.2rem',
        py: displayMode ? 1 : 0,
        textAlign: displayMode ? 'center' : 'left',
        '& .katex': { fontSize: 'inherit' },
        '& .katex-html': { overflowX: 'auto' },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── Step dot indicator ────────────────────────────────────────────────────────

function StepDots({ total, revealedCount, isDark }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width:  i < revealedCount ? 18 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i < revealedCount
              ? (isDark ? PALETTE.warmSilver : PALETTE.nearBlackText)
              : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
            transition: 'all 0.25s ease',
          }}
        />
      ))}
    </Box>
  )
}

// ── Accordion step card ───────────────────────────────────────────────────────

function StepCard({ step, index, isCollapsed, onToggle, displayMode, fontSize, highlights, isDark }) {
  const stepColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.42)'
  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream

  return (
    <Box sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: `${RADIUS.md}px`,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    }}>
      {/* Step header — click to collapse */}
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          transition: 'background-color 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: stepColor, lineHeight: 1 }}>
              {index + 1}
            </Typography>
          </Box>
          {step.label && (
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: stepColor,
              textTransform: 'uppercase',
              letterSpacing: TYPOGRAPHY.letterSpacing?.wide ?? '0.04em',
            }}>
              {step.label}
            </Typography>
          )}
        </Box>
        {isCollapsed
          ? <ExpandMoreIcon sx={{ fontSize: 16, color: stepColor }} />
          : <ExpandLessIcon  sx={{ fontSize: 16, color: stepColor }} />
        }
      </Box>

      {/* Formula content */}
      <Collapse in={!isCollapsed} timeout={200}>
        <Box sx={{ px: 3, pb: 2, pt: 0.5 }}>
          <FormulaDisplay
            latex={step.latex}
            displayMode={displayMode}
            fontSize={fontSize}
            highlights={highlights}
            isDark={isDark}
          />
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MathFormula({
  entityId,
  latex,
  displayMode  = true,
  steps,
  highlights   = [],
  caption,
  fontSize,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const hasSteps = Array.isArray(steps) && steps.length > 0

  // Accordion state — how many steps have been revealed
  const [revealedCount, setRevealedCount] = useState(1)
  // Which step cards are individually collapsed (by index)
  const [collapsedSet, setCollapsedSet] = useState(new Set())

  const goNext = useCallback(() => {
    setRevealedCount(r => Math.min(steps?.length ?? 1, r + 1))
  }, [steps])

  const goPrev = useCallback(() => {
    setRevealedCount(r => Math.max(1, r - 1))
  }, [])

  const toggleCollapse = useCallback((i) => {
    setCollapsedSet(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }, [])

  if (!latex && !hasSteps) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        math_formula: requires "latex" or "steps" prop
      </Box>
    )
  }

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const navDisabledColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'
  const navActiveColor   = isDark ? PALETTE.warmSilver : PALETTE.nearBlackText

  // ── Single formula (no steps) ─────────────────────────────────────────────
  if (!hasSteps) {
    return (
      <Box>
        <Box sx={{
          border: `1px solid ${borderColor}`,
          borderRadius: `${RADIUS.lg}px`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          px: 3, py: 2,
          overflowX: 'auto',
        }}>
          <FormulaDisplay
            latex={latex}
            displayMode={displayMode}
            fontSize={fontSize}
            highlights={highlights}
            isDark={isDark}
          />
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

  // ── Multi-step accordion ──────────────────────────────────────────────────
  const atStart = revealedCount <= 1
  const atEnd   = revealedCount >= steps.length

  return (
    <Box>
      {/* Accordion step cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {steps.slice(0, revealedCount).map((s, i) => (
          <StepCard
            key={i}
            step={s}
            index={i}
            isCollapsed={collapsedSet.has(i)}
            onToggle={() => toggleCollapse(i)}
            displayMode={displayMode}
            fontSize={fontSize}
            highlights={highlights}
            isDark={isDark}
          />
        ))}
      </Box>

      {/* Navigation row: ← dots → */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mt: 1.5, px: 0.5,
      }}>
        <Tooltip title={atStart ? '' : 'Hide last step'}>
          <span>
            <IconButton
              size="small"
              onClick={goPrev}
              disabled={atStart}
              aria-label="Previous step"
              sx={{
                color: atStart ? navDisabledColor : navActiveColor,
                width: 32, height: 32,
                border: `1px solid ${atStart ? 'transparent' : borderColor}`,
                borderRadius: '8px',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                transition: 'all 0.15s',
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>

        <StepDots total={steps.length} revealedCount={revealedCount} isDark={isDark} />

        <Tooltip title={atEnd ? 'All steps revealed' : 'Reveal next step'}>
          <span>
            <IconButton
              size="small"
              onClick={goNext}
              disabled={atEnd}
              aria-label="Next step"
              sx={{
                color: atEnd ? navDisabledColor : navActiveColor,
                width: 32, height: 32,
                border: `1px solid ${atEnd ? 'transparent' : borderColor}`,
                borderRadius: '8px',
                backgroundColor: atEnd ? 'transparent' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)' },
                transition: 'all 0.15s',
              }}
            >
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
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
