import { useMemo } from 'react'
import { Box, Typography, Tooltip, useTheme } from '@mui/material'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useSceneStore } from '../useSceneStore'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

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
        py: displayMode ? 1.5 : 0,
        textAlign: displayMode ? 'center' : 'left',
        '& .katex': { fontSize: 'inherit' },
        '& .katex-html': { overflowX: 'auto' },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

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

  const stepIndex    = useSceneStore(s => s.getStep(entityId))
  const setStep      = useSceneStore(s => s.setStep)
  const hasSteps     = Array.isArray(steps) && steps.length > 0
  const activeStep   = hasSteps ? steps[Math.min(stepIndex, steps.length - 1)] : null
  const activLatex   = activeStep?.latex ?? latex ?? ''
  const stepLabel    = activeStep?.label

  if (!activLatex && !hasSteps) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        math_formula: requires "latex" or "steps" prop
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: `${RADIUS.lg}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        px: 3, py: 2,
        overflowX: 'auto',
      }}>
        {hasSteps && stepLabel && (
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            mb: 1,
            textTransform: 'uppercase',
            letterSpacing: TYPOGRAPHY.letterSpacing.wide,
          }}>
            {stepLabel}
          </Typography>
        )}

        <FormulaDisplay
          latex={activLatex}
          displayMode={displayMode}
          fontSize={fontSize}
          highlights={highlights}
          isDark={isDark}
        />

        {hasSteps && (
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {steps.map((s, i) => (
              <Tooltip key={i} title={s.label ?? `Step ${i + 1}`} placement="top">
                <Box
                  onClick={() => setStep(entityId, i)}
                  sx={{
                    width: i === stepIndex ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    cursor: 'pointer',
                    backgroundColor: i <= stepIndex
                      ? (isDark ? PALETTE.warmSilver : PALETTE.nearBlackText)
                      : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
                      transform: 'scale(1.2)',
                    },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1,
          fontSize: TYPOGRAPHY.sizes.caption,
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
          textAlign: 'center',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
