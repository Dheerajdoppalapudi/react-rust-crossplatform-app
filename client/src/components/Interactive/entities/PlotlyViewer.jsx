import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

// Use the pre-built dist so Rollup/Vite never tries to treeshake the full source.
const Plot = createPlotlyComponent(Plotly)

const FONT_FAMILY = '"Inter", "Roboto", system-ui, sans-serif'

function buildLayout(userLayout, isDark, width) {
  const bg        = 'rgba(0,0,0,0)'
  const plotBg    = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const lineColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const textColor = isDark ? PALETTE.warmSilver : PALETTE.nearBlackText
  const subColor  = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'

  const axisDefaults = {
    gridcolor:       gridColor,
    linecolor:       lineColor,
    tickcolor:       lineColor,
    tickfont:        { family: FONT_FAMILY, size: 11, color: subColor },
    title:           { font: { family: FONT_FAMILY, size: 12, color: subColor } },
    showgrid:        true,
    zeroline:        false,
    automargin:      true,
  }

  return {
    // geometry
    autosize:       true,
    width:          width ?? undefined,
    height:         userLayout?.height ?? 380,
    margin:         { l: 48, r: 24, t: userLayout?.title ? 48 : 24, b: 48, pad: 0 },

    // colours
    paper_bgcolor:  bg,
    plot_bgcolor:   plotBg,
    template:       isDark ? 'plotly_dark' : 'plotly_white',

    // fonts
    font: { family: FONT_FAMILY, color: textColor },

    // title
    ...(userLayout?.title ? {
      title: {
        text:  userLayout.title,
        font:  { family: FONT_FAMILY, size: 14, color: textColor },
        x:     0.04,
        xanchor: 'left',
      },
    } : {}),

    // legend
    legend: {
      bgcolor:     'rgba(0,0,0,0)',
      bordercolor: 'transparent',
      font:        { family: FONT_FAMILY, size: 11, color: subColor },
      ...(userLayout?.legend ?? {}),
    },

    // axes defaults (LLM can override via xaxis/yaxis in layout prop)
    xaxis: { ...axisDefaults, ...(userLayout?.xaxis ?? {}) },
    yaxis: { ...axisDefaults, ...(userLayout?.yaxis ?? {}) },

    // geo / mapbox defaults
    geo: {
      bgcolor:   bg,
      landcolor: isDark ? '#1e2a1e' : '#d4e6c3',
      oceancolor:isDark ? '#0d1b2a' : '#c6dff0',
      framecolor:lineColor,
      showframe: false,
      ...(userLayout?.geo ?? {}),
    },

    // spread everything else the LLM provided (xaxis2, yaxis2, shapes, annotations …)
    ...Object.fromEntries(
      Object.entries(userLayout ?? {}).filter(([k]) =>
        !['title', 'height', 'legend', 'xaxis', 'yaxis', 'geo'].includes(k)
      )
    ),
  }
}

const BASE_CONFIG = {
  displaylogo:    false,
  responsive:     true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'select2d', 'lasso2d'],
  toImageButtonOptions: { format: 'png', scale: 2 },
}

export default function PlotlyViewer({ entityId, data, layout: userLayout, config: userConfig, caption }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [error, setError] = useState(null)

  const mergedLayout = useMemo(
    () => buildLayout(userLayout, isDark),
    [userLayout, isDark]
  )

  const mergedConfig = useMemo(
    () => ({ ...BASE_CONFIG, ...(userConfig ?? {}) }),
    [userConfig]
  )

  const handleError = useCallback((err) => {
    console.error('[PlotlyViewer] render error', err)
    setError(String(err?.message ?? err))
  }, [])

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        plotly: requires a non-empty "data" traces array
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{
        p: 2, borderRadius: `${RADIUS.md}px`,
        border: '1px solid', borderColor: 'error.main',
        color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption,
      }}>
        Chart error: {error}
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isDark ? PALETTE.borderDark : PALETTE.borderCream,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        '& .js-plotly-plot': { borderRadius: `${RADIUS.lg}px` },
        '& .modebar': { top: '4px !important', right: '8px !important' },
        '& .modebar-btn': { color: `${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} !important` },
        '& .modebar-btn:hover': { color: `${isDark ? '#fff' : '#000'} !important` },
      }}>
        <Plot
          data={data}
          layout={mergedLayout}
          config={mergedConfig}
          useResizeHandler
          style={{ width: '100%', display: 'block' }}
          onError={handleError}
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
