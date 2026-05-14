import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip, Chip, useTheme } from '@mui/material'
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon   from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon   from '@mui/icons-material/UnfoldLess'
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
    result = result.replace(pattern, `<span style="color:${color};font-weight:600"${title}>${term}</span>`)
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

// ── Accordion step card ───────────────────────────────────────────────────────

function StepCard({ step, index, displayMode, fontSize, highlights, isDark }) {
  const stepColor   = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.42)'
  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream

  return (
    <Box sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: `${RADIUS.md}px`,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1 }}>
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

      <Box sx={{ px: 3, pb: 2, pt: 0.5 }}>
        <FormulaDisplay
          latex={step.latex}
          displayMode={displayMode}
          fontSize={fontSize}
          highlights={highlights}
          isDark={isDark}
        />
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MathFormula({
  entityId,
  latex,
  displayMode = true,
  steps,
  highlights  = [],
  caption,
  fontSize,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const hasSteps = Array.isArray(steps) && steps.length > 0

  const [revealedCount, setRevealedCount] = useState(1)
  const [showAll,       setShowAll]       = useState(false)

  const goNext = useCallback(() => {
    setRevealedCount(r => Math.min(steps?.length ?? 1, r + 1))
  }, [steps])

  const goPrev = useCallback(() => {
    setRevealedCount(r => Math.max(1, r - 1))
  }, [])

  const handleToggleShowAll = useCallback(() => {
    setShowAll(s => {
      if (!s) setRevealedCount(steps?.length ?? 1) // sync count when switching to show-all
      return !s
    })
  }, [steps])

  if (!latex && !hasSteps) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        math_formula: requires "latex" or "steps" prop
      </Box>
    )
  }

  const borderColor      = isDark ? PALETTE.borderDark : PALETTE.borderCream
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
          px: 3, py: 2, overflowX: 'auto',
        }}>
          <FormulaDisplay latex={latex} displayMode={displayMode} fontSize={fontSize} highlights={highlights} isDark={isDark} />
        </Box>
        {caption && (
          <Typography sx={{ mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
            {caption}
          </Typography>
        )}
      </Box>
    )
  }

  // ── Multi-step accordion ──────────────────────────────────────────────────
  const atStart = revealedCount <= 1
  const atEnd        = revealedCount >= steps.length

  return (
    <Box>
      {/* ── Control bar (above cards) ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 1, px: 0.5,
      }}>
        {/* Left: step navigation (hidden in show-all mode) */}
        {showAll ? (
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={atStart ? '' : 'Hide last step'}>
              <span>
                <IconButton
                  size="small" onClick={goPrev} disabled={atStart} aria-label="Previous step"
                  sx={{
                    color: atStart ? navDisabledColor : navActiveColor,
                    width: 30, height: 30,
                    border: `1px solid ${atStart ? 'transparent' : borderColor}`,
                    borderRadius: '8px',
                    '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>

            <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary', px: 0.5, minWidth: 64, textAlign: 'center' }}>
              Step {revealedCount} of {steps.length}
            </Typography>

            <Tooltip title={atEnd ? 'All steps revealed' : 'Reveal next step'}>
              <span>
                <IconButton
                  size="small" onClick={goNext} disabled={atEnd} aria-label="Next step"
                  sx={{
                    color: atEnd ? navDisabledColor : navActiveColor,
                    width: 30, height: 30,
                    border: `1px solid ${atEnd ? 'transparent' : borderColor}`,
                    borderRadius: '8px',
                    backgroundColor: atEnd ? 'transparent' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                    '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}

        {/* Right: Show all / Step by step toggle */}
        <Tooltip title={showAll ? 'Switch to step-by-step mode' : 'Reveal all steps at once'}>
          <Chip
            icon={showAll
              ? <UnfoldLessIcon sx={{ fontSize: '14px !important' }} />
              : <UnfoldMoreIcon sx={{ fontSize: '14px !important' }} />
            }
            label={showAll ? 'Step by step' : 'Show all'}
            size="small"
            onClick={handleToggleShowAll}
            sx={{
              height: 24, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              backgroundColor: showAll
                ? (isDark ? `${BRAND.primary}22` : `${BRAND.primary}14`)
                : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
              color: showAll ? BRAND.primary : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
              border: `1px solid ${showAll ? `${BRAND.primary}44` : 'transparent'}`,
              '&:hover': { opacity: 0.8 },
              transition: 'all 0.2s',
            }}
          />
        </Tooltip>
      </Box>

      {/* ── Step cards / unified block ── */}
      {showAll ? (
        /* Single unified block — all steps flow inside one box */
        <Box sx={{
          border: `1px solid ${borderColor}`,
          borderRadius: `${RADIUS.lg}px`,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          {steps.map((s, i) => (
            <Box key={i} sx={{
              px: 3, py: 2,
              borderBottom: i < steps.length - 1 ? `1px solid ${borderColor}` : 'none',
            }}>
              {s.label && (
                <Typography sx={{
                  fontSize: TYPOGRAPHY.sizes.caption,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)',
                  textTransform: 'uppercase',
                  letterSpacing: TYPOGRAPHY.letterSpacing?.wide ?? '0.04em',
                  mb: 0.5,
                }}>
                  {i + 1}. {s.label}
                </Typography>
              )}
              <FormulaDisplay
                latex={s.latex}
                displayMode={displayMode}
                fontSize={fontSize}
                highlights={highlights}
                isDark={isDark}
              />
            </Box>
          ))}
        </Box>
      ) : (
        /* Step-by-step — only the current step */
        <StepCard
          key={revealedCount - 1}
          step={steps[revealedCount - 1]}
          index={revealedCount - 1}
          isCollapsed={false}
          onToggle={() => {}}
          displayMode={displayMode}
          fontSize={fontSize}
          highlights={highlights}
          isDark={isDark}
        />
      )}

      {caption && (
        <Typography sx={{ mt: 1.5, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
