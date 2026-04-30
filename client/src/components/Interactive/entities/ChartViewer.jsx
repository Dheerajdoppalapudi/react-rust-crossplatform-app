import { Box, Typography, useTheme } from '@mui/material'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  ScatterChart, Scatter, XAxis as SXAxis, YAxis as SYAxis,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

const DEFAULT_COLORS = [
  BRAND.primary,
  BRAND.accent,
  PALETTE.warningOrange,
  PALETTE.successGreen,
  '#e879f9',
  '#38bdf8',
  '#fb7185',
  '#a3e635',
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

function gridColor(isDark) {
  return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
}

function axisStyle(isDark) {
  return { fontSize: TYPOGRAPHY.sizes.caption, fill: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }
}

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

export default function ChartViewer({
  type        = 'bar',
  data        = [],
  series      = [],
  xKey,
  pieKey      = 'value',
  nameKey     = 'name',
  title,
  xLabel,
  yLabel,
  height      = 280,
  stacked     = false,
  layout      = 'horizontal',
  logScale    = false,
  showLegend  = true,
  showGrid    = true,
  showDots    = false,
  referenceLines = [],
  colors,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const tt     = buildTooltipStyle(isDark)
  const grid   = gridColor(isDark)
  const axis   = axisStyle(isDark)
  const yScale = logScale ? 'log' : 'auto'
  const stack  = stacked ? 'a' : undefined

  const sharedAxisProps = { tick: axis, axisLine: false, tickLine: false }
  const isVertical = layout === 'vertical'

  // For vertical bar layout (horizontal bars), axes must be swapped:
  // YAxis holds the categories, XAxis holds the numeric values.
  const commonChildren = (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={grid} />}
      {isVertical
        ? <>
            <XAxis type="number" scale={yScale} {...sharedAxisProps} label={yLabel ? { value: yLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
            <YAxis type="category" dataKey={xKey} {...sharedAxisProps} width={80} label={xLabel ? { value: xLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
          </>
        : <>
            <XAxis dataKey={xKey} {...sharedAxisProps} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, style: axis } : undefined} />
            <YAxis scale={yScale} {...sharedAxisProps} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: axis } : undefined} />
          </>
      }
      <Tooltip {...tt} />
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
    </>
  )

  let chart = null

  if (type === 'pie' || type === 'donut') {
    const pieData = data.map((d, i) => ({ ...d, fill: d.fill ?? color(null, i, colors) }))
    const innerR  = type === 'donut' ? '40%' : 0
    chart = (
      <PieChart>
        <Pie data={pieData} dataKey={pieKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius="70%" innerRadius={innerR} label>
          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip {...tt} />
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
        <Tooltip {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
      </RadarChart>
    )
  } else if (type === 'scatter') {
    chart = (
      <ScatterChart>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={grid} />}
        <SXAxis dataKey={series[0]?.dataKey ?? 'x'} type="number" {...sharedAxisProps} />
        <SYAxis dataKey={series[1]?.dataKey ?? 'y'} type="number" {...sharedAxisProps} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} {...tt} />
        {showLegend && <Legend wrapperStyle={{ fontSize: TYPOGRAPHY.sizes.caption }} />}
        <Scatter name={series[0]?.name ?? 'data'} data={data} fill={color(series[0], 0, colors)} />
      </ScatterChart>
    )
  } else if (type === 'composed') {
    chart = (
      <ComposedChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
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
      <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
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
      <ChartTitle title={title} isDark={isDark} />
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
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
