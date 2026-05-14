import { useRef, useCallback, useMemo } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
  XAxis as SXAxis, YAxis as SYAxis,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ReferenceLine, ReferenceDot,
} from 'recharts'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

const DEFAULT_COLORS = [
  BRAND.primary, BRAND.accent,
  PALETTE.warningOrange, PALETTE.successGreen,
  '#e879f9', '#38bdf8', '#fb7185', '#a3e635',
]

function color(series, index, colors) {
  if (series?.color) return series.color
  if (colors?.[index]) return colors[index]
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

function buildTooltipStyle(isDark) {
  return {
    contentStyle: {
      backgroundColor: isDark ? PALETTE.darkSubsurface : '#ffffff',
      border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
      borderRadius: RADIUS.md,
      fontSize: TYPOGRAPHY.sizes.caption,
      color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
    },
    labelStyle: { fontWeight: TYPOGRAPHY.weights.semibold },
  }
}

function gridColor(isDark) { return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }
function axisStyle(isDark)  { return { fontSize: TYPOGRAPHY.sizes.caption, fill: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' } }

function ChartTitle({ title, isDark }) {
  if (!title) return null
  return (
    <Typography sx={{
      fontSize: TYPOGRAPHY.sizes.bodySm,
      fontWeight: TYPOGRAPHY.weights.semibold,
      color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
      mb: 1,
    }}>
      {title}
    </Typography>
  )
}

// ── Heatmap (custom — Recharts has no built-in heatmap) ───────────────────────

function interpolateColor(value, min, max, isDark) {
  const t = max === min ? 0 : (value - min) / (max - min)
  // cool → warm: blue → orange/red
  const r = Math.round(59  + t * (239 - 59))
  const g = Math.round(130 + t * (68  - 130))
  const b = Math.round(246 + t * (68  - 246))
  return `rgb(${r},${g},${b})`
}

function HeatmapChart({ data, xKey = 'x', yKey = 'y', valueKey = 'value', title, caption, isDark }) {
  const xs = useMemo(() => [...new Set(data.map(d => d[xKey]))], [data, xKey])
  const ys = useMemo(() => [...new Set(data.map(d => d[yKey]))], [data, yKey])
  const vals = useMemo(() => data.map(d => d[valueKey]), [data, valueKey])
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)

  const cellMap = useMemo(() => {
    const m = {}
    data.forEach(d => { m[`${d[xKey]}__${d[yKey]}`] = d[valueKey] })
    return m
  }, [data, xKey, yKey, valueKey])

  const yLabelWidth = Math.max(...ys.map(y => String(y).length)) * 7 + 8

  return (
    <Box>
      <Box sx={{ display: 'flex' }}>
        {/* Y-axis labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', pr: 1, minWidth: yLabelWidth }}>
          {ys.map(y => (
            <Typography key={y} sx={{
              fontSize: 10, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              textAlign: 'right', lineHeight: 1, py: 0.25,
            }}>
              {y}
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: 1 }}>
          {/* Grid */}
          {ys.map(y => (
            <Box key={y} sx={{ display: 'flex', gap: '2px', mb: '2px' }}>
              {xs.map(x => {
                const val = cellMap[`${x}__${y}`] ?? 0
                const bg  = interpolateColor(val, min, max, isDark)
                return (
                  <Tooltip key={x} title={`${x} / ${y}: ${val}`} arrow>
                    <Box sx={{
                      flex: 1, height: 32, borderRadius: '3px',
                      backgroundColor: bg,
                      opacity: 0.85,
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                      '&:hover': { opacity: 1 },
                    }} />
                  </Tooltip>
                )
              })}
            </Box>
          ))}

          {/* X-axis labels */}
          <Box sx={{ display: 'flex', gap: '2px', mt: 0.75 }}>
            {xs.map(x => (
              <Typography key={x} sx={{
                flex: 1, fontSize: 10, textAlign: 'center',
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {x}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Color scale legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
        <Typography sx={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>{min}</Typography>
        <Box sx={{
          flex: 1, height: 6, borderRadius: 3,
          background: `linear-gradient(to right, ${interpolateColor(min, min, max, isDark)}, ${interpolateColor(max, min, max, isDark)})`,
        }} />
        <Typography sx={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>{max}</Typography>
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChartViewer({
  type        = 'bar',
  data        = [],
  series      = [],
  xKey,
  yKey,
  valueKey    = 'value',
  pieKey      = 'value',
  nameKey     = 'name',
  zKey        = 'z',
  title,
  xLabel,
  yLabel,
  height      = 300,
  stacked     = false,
  layout      = 'horizontal',
  logScale    = false,
  showLegend  = true,
  showGrid    = true,
  showDots    = false,
  referenceLines = [],
  annotations    = [],
  colors,
  caption,
}) {
  const theme     = useTheme()
  const isDark    = theme.palette.mode === 'dark'
  const chartRef  = useRef(null)
  const tt        = buildTooltipStyle(isDark)
  const grid      = gridColor(isDark)
  const axis      = axisStyle(isDark)
  const yScale    = logScale ? 'log' : 'auto'
  const stack     = stacked ? 'a' : undefined
  const isVertical = layout === 'vertical'

  const handleDownload = useCallback(() => {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr     = serializer.serializeToString(svg)
    const blob       = new Blob([svgStr], { type: 'image/svg+xml' })
    const url        = URL.createObjectURL(blob)
    const a          = document.createElement('a')
    a.href           = url
    a.download       = 'chart.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const sharedAxisProps = { tick: axis, axisLine: false, tickLine: false }

  const annotationDots = annotations.map((a, i) => (
    <ReferenceDot
      key={`ann-${i}`}
      x={a.x} y={a.y}
      r={5}
      fill={a.color ?? PALETTE.warningOrange}
      stroke="none"
      label={{ value: a.label ?? '', position: 'top', fontSize: 11, fill: a.color ?? PALETTE.warningOrange }}
    />
  ))

  const commonChildren = (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={grid} />}
      {isVertical
        ? <>
            <XAxis type="number" scale={yScale} {...sharedAxisProps}
              label={yLabel ? { value: yLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
            <YAxis type="category" dataKey={xKey} {...sharedAxisProps} width={80}
              label={xLabel ? { value: xLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
          </>
        : <>
            <XAxis dataKey={xKey} {...sharedAxisProps}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
            <YAxis scale={yScale} {...sharedAxisProps}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
          </>
      }
      <RTooltip {...tt} />
      {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
      {referenceLines.map((rl, i) => (
        <ReferenceLine
          key={i}
          x={rl.axis === 'x' ? rl.value : undefined}
          y={rl.axis !== 'x' ? rl.value : undefined}
          stroke={rl.color ?? PALETTE.successGreen}
          strokeDasharray="4 3"
          label={{ value: rl.label ?? '', fill: rl.color ?? PALETTE.successGreen, fontSize: TYPOGRAPHY.sizes.caption }}
        />
      ))}
      {annotationDots}
    </>
  )

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  if (type === 'heatmap') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: title ? 0 : 0.5 }}>
          <ChartTitle title={title} isDark={isDark} />
        </Box>
        <HeatmapChart
          data={data}
          xKey={xKey ?? 'x'}
          yKey={yKey ?? 'y'}
          valueKey={valueKey}
          isDark={isDark}
        />
        {caption && (
          <Typography sx={{ mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
            {caption}
          </Typography>
        )}
      </Box>
    )
  }

  let chart = null

  if (type === 'pie' || type === 'donut') {
    const pieData = data.map((d, i) => ({ ...d, fill: d.fill ?? color(null, i, colors) }))
    const innerR  = type === 'donut' ? '40%' : 0
    chart = (
      <PieChart>
        <Pie data={pieData} dataKey={pieKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius="70%" innerRadius={innerR} label>
          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <RTooltip {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
      </PieChart>
    )
  } else if (type === 'radar') {
    chart = (
      <RadarChart data={data}>
        <PolarGrid stroke={grid} />
        <PolarAngleAxis dataKey={xKey} tick={axis} />
        <PolarRadiusAxis tick={axis} />
        {series.map((s, i) => (
          <Radar key={s.dataKey} name={s.name ?? s.dataKey} dataKey={s.dataKey}
            stroke={color(s, i, colors)} fill={color(s, i, colors)} fillOpacity={0.3} />
        ))}
        <RTooltip {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
      </RadarChart>
    )

  } else if (type === 'bubble') {
    // Bubble: scatter chart where a third variable (zKey) controls dot size
    const multiGroup = series.some(s => Array.isArray(s.data))
    chart = (
      <ScatterChart>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={grid} />}
        <SXAxis dataKey="x" type="number" name={xLabel ?? 'x'} {...sharedAxisProps}
          label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
        <SYAxis dataKey="y" type="number" name={yLabel ?? 'y'} {...sharedAxisProps}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
        <ZAxis dataKey={zKey} range={[30, 500]} name={zKey} />
        <RTooltip cursor={{ strokeDasharray: '3 3' }} {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
        {multiGroup
          ? series.map((s, i) => (
              <Scatter key={i} name={s.name ?? `Group ${i + 1}`} data={s.data} fill={color(s, i, colors)} fillOpacity={0.75} />
            ))
          : <Scatter name={series[0]?.name ?? 'data'} data={data} fill={color(series[0], 0, colors)} fillOpacity={0.75} />
        }
      </ScatterChart>
    )

  } else if (type === 'scatter') {
    // Multi-group scatter: each series can have its own data array
    const multiGroup = series.some(s => Array.isArray(s.data))
    const xDataKey   = series[0]?.xKey ?? 'x'
    const yDataKey   = series[0]?.yKey ?? 'y'
    chart = (
      <ScatterChart>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={grid} />}
        <SXAxis dataKey={xDataKey} type="number" name={xLabel ?? xDataKey} {...sharedAxisProps}
          label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
        <SYAxis dataKey={yDataKey} type="number" name={yLabel ?? yDataKey} {...sharedAxisProps}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
        <RTooltip cursor={{ strokeDasharray: '3 3' }} {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
        {multiGroup
          ? series.map((s, i) => (
              <Scatter key={i} name={s.name ?? `Group ${i + 1}`} data={s.data} fill={color(s, i, colors)} />
            ))
          : <Scatter name={series[0]?.name ?? 'data'} data={data} fill={color(series[0], 0, colors)} />
        }
        {annotationDots}
      </ScatterChart>
    )

  } else if (type === 'composed') {
    chart = (
      <ComposedChart data={data} layout={isVertical ? 'vertical' : 'horizontal'}>
        {commonChildren}
        {series.map((s, i) => {
          const c = color(s, i, colors)
          if (s.type === 'line') return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={c} dot={showDots} />
          if (s.type === 'area')  return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={c} fill={c} fillOpacity={0.15} stackId={stack} />
          return <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={c} stackId={stack} radius={[3,3,0,0]} />
        })}
      </ComposedChart>
    )
  } else if (type === 'area') {
    chart = (
      <AreaChart data={data}>
        {commonChildren}
        {series.map((s, i) => {
          const c = color(s, i, colors)
          return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={c} fill={c} fillOpacity={0.15} stackId={stack} />
        })}
      </AreaChart>
    )
  } else if (type === 'line') {
    chart = (
      <LineChart data={data}>
        {commonChildren}
        {series.map((s, i) => (
          <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name}
            stroke={color(s, i, colors)} dot={showDots} strokeWidth={2} />
        ))}
      </LineChart>
    )
  } else {
    // bar (default)
    chart = (
      <BarChart data={data} layout={isVertical ? 'vertical' : 'horizontal'}>
        {commonChildren}
        {series.map((s, i) => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name}
            fill={color(s, i, colors)} stackId={stack} radius={[3,3,0,0]} />
        ))}
      </BarChart>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: title ? 0 : 0.5 }}>
        <ChartTitle title={title} isDark={isDark} />
        <Tooltip title="Download SVG">
          <IconButton size="small" onClick={handleDownload} aria-label="Download chart"
            sx={{ color: 'text.disabled', width: 26, height: 26, ml: 'auto' }}>
            <DownloadIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box ref={chartRef}>
        <ResponsiveContainer width="100%" height={height}>
          {chart}
        </ResponsiveContainer>
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
