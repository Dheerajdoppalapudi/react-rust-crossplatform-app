import { useMemo } from 'react'
import { Box, useTheme } from '@mui/material'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
import * as math from 'mathjs'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'
import EntityCaption from './EntityCaption'

// Pre-built dist — avoids Rollup treeshaking the full mathjs/plotly source
const Plot = createPlotlyComponent(Plotly)

const FONT   = '"Inter", "Roboto", system-ui, sans-serif'
const COLORS = ['#4dabf7', '#f783ac', '#ffa94d', '#a9e34b', '#da77f2', '#74c0fc']

// ── Expression evaluation ──────────────────────────────────────────────────────

function sampleFn(expr, domain, samples) {
  const [xMin, xMax] = domain
  let compiled
  try {
    compiled = math.compile(expr)
  } catch (err) {
    return { xs: [], ys: [], error: `Syntax error: ${err.message}` }
  }

  const xs = new Array(samples)
  const ys = new Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = xMin + (i / (samples - 1)) * (xMax - xMin)
    xs[i] = x
    try {
      const y = compiled.evaluate({ x })
      ys[i] = typeof y === 'number' && isFinite(y) ? y : null
    } catch {
      ys[i] = null
    }
  }
  return { xs, ys, error: null }
}

// ── Plotly layout builder ─────────────────────────────────────────────────────

function buildLayout(isDark, title, yRange) {
  const text    = isDark ? PALETTE.warmSilver    : PALETTE.nearBlackText
  const sub     = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
  const grid    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const line    = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const zero    = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'

  const axis = {
    gridcolor:     grid,
    linecolor:     line,
    tickcolor:     line,
    tickfont:      { family: FONT, size: 11, color: sub },
    zeroline:      true,
    zerolinecolor: zero,
    zerolinewidth: 1.5,
    showgrid:      true,
    automargin:    true,
  }

  return {
    autosize:       true,
    height:         360,
    margin:         { l: 52, r: 24, t: title ? 46 : 20, b: 46, pad: 0 },
    paper_bgcolor:  'rgba(0,0,0,0)',
    plot_bgcolor:   isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    template:       isDark ? 'plotly_dark' : 'plotly_white',
    font:           { family: FONT, color: text },
    hovermode:      'x unified',
    ...(title ? {
      title: { text: title, font: { family: FONT, size: 14, color: text }, x: 0.04, xanchor: 'left' },
    } : {}),
    xaxis: {
      ...axis,
      title: { text: 'x', font: { family: FONT, size: 12, color: sub } },
    },
    yaxis: {
      ...axis,
      title:        { text: 'f(x)', font: { family: FONT, size: 12, color: sub } },
      ...(yRange ? { range: yRange } : {}),
    },
    legend: {
      bgcolor:     'rgba(0,0,0,0)',
      bordercolor: 'transparent',
      font:        { family: FONT, size: 11, color: sub },
    },
  }
}

const CONFIG = {
  displaylogo:            false,
  responsive:             true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'sendDataToCloud'],
  toImageButtonOptions:   { format: 'png', scale: 2 },
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FunctionPlotter({
  entityId,
  expr,
  functions,
  domain  = [-10, 10],
  range:  yRange,
  samples = 500,
  title,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Accept either `expr` (single string) or `functions` (array)
  const fnList = useMemo(() => {
    if (Array.isArray(functions) && functions.length > 0) return functions
    if (typeof expr === 'string' && expr.trim()) return [{ expr: expr.trim() }]
    return []
  }, [expr, functions])

  const { traces, errors } = useMemo(() => {
    const traces = []
    const errors = []
    fnList.forEach(({ expr: e, label, color }, i) => {
      const { xs, ys, error } = sampleFn(e, domain, samples)
      if (error) { errors.push({ expr: e, error }); return }
      traces.push({
        type:         'scatter',
        mode:         'lines',
        name:         label ?? e,
        x:            xs,
        y:            ys,
        connectgaps:  false,   // renders gaps at discontinuities (tan(x), 1/x …)
        line:         { color: color ?? COLORS[i % COLORS.length], width: 2.5 },
        hovertemplate:`<b>${label ?? e}</b><br>x = %{x:.4f}<br>y = %{y:.4f}<extra></extra>`,
      })
    })
    return { traces, errors }
  }, [fnList, domain, samples])

  const layout = useMemo(() => buildLayout(isDark, title, yRange), [isDark, title, yRange])

  if (fnList.length === 0) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        function_plotter: requires "expr" (string) or "functions" ([{'{'}expr{'}'}])
      </Box>
    )
  }

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.border

  return (
    <Box>
      {/* ── Expression errors ── */}
      {errors.map(({ expr: e, error }) => (
        <Box key={e} sx={{
          mb: 1, px: 1.5, py: 0.75,
          borderRadius: `${RADIUS.sm}px`,
          backgroundColor: 'rgba(200,0,0,0.06)',
          border: '1px solid', borderColor: 'error.main',
          fontSize: TYPOGRAPHY.sizes.caption, color: 'error.main',
        }}>
          {error} — <code>{e}</code>
        </Box>
      ))}

      {/* ── Plot ── */}
      {traces.length > 0 && (
        <Box sx={{
          borderRadius: `${RADIUS.lg}px`,
          overflow: 'hidden',
          border: `1px solid ${borderColor}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          '& .modebar':      { top: '4px !important', right: '8px !important' },
          '& .modebar-btn':  { color: `${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} !important` },
          '& .modebar-btn:hover': { color: `${isDark ? '#fff' : '#000'} !important` },
        }}>
          <Plot
            data={traces}
            layout={layout}
            config={CONFIG}
            useResizeHandler
            style={{ width: '100%', display: 'block' }}
          />
        </Box>
      )}

      <EntityCaption caption={caption} />
    </Box>
  )
}
