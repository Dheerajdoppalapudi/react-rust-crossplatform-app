import { useMemo } from 'react'
import { Box, useTheme } from '@mui/material'
import dagre from 'dagre'

const DOT_R   = 3.5
const NODE_SZ = 10
const PAD     = 10

function buildLayout(turns) {
  const valid = turns.filter((t) => t.id)
  if (!valid.length) return { nodes: [], edges: [], width: 0, height: 0 }

  const byId = Object.fromEntries(valid.map((t) => [t.id, t]))

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 22, ranksep: 30 })
  valid.forEach((t) => g.setNode(t.id, { width: NODE_SZ, height: NODE_SZ }))
  valid
    .filter((t) => t.parentSessionId && byId[t.parentSessionId])
    .forEach((t) => g.setEdge(t.parentSessionId, t.id))
  dagre.layout(g)

  const graph     = g.graph()
  const nodes     = valid.map((t) => { const { x, y } = g.node(t.id); return { turn: t, x, y } })
  const nodeById  = Object.fromEntries(nodes.map((n) => [n.turn.id, n]))
  const edges     = valid
    .filter((t) => t.parentSessionId && nodeById[t.parentSessionId] && nodeById[t.id])
    .map((t)   => ({ from: nodeById[t.parentSessionId], to: nodeById[t.id] }))

  return { nodes, edges, width: graph.width || 0, height: graph.height || 0 }
}

export default function ConversationMiniTree({ turns, onNavigate }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const hasBranches = turns.filter((t) => t.id).length > 1 && turns.some((t) => t.parentSessionId)
  const { nodes, edges, width, height } = useMemo(() => buildLayout(turns), [turns])

  if (!hasBranches) return null

  const svgW       = width  + PAD * 2
  const svgH       = height + PAD * 2
  const lineColor  = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.14)'
  const ringColor  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'

  return (
    <Box sx={{
      position: 'absolute',
      right: 16, top: '50%', transform: 'translateY(-50%)',
      zIndex: 5,
      pointerEvents: 'none',
    }}>
      <svg width={svgW} height={svgH} style={{ overflow: 'visible', display: 'block' }}>
        {/* Curved edges */}
        {edges.map((e, i) => {
          const x1   = e.from.x + PAD,  y1 = e.from.y + PAD
          const x2   = e.to.x   + PAD,  y2 = e.to.y   + PAD
          const midY = (y1 + y2) / 2
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.5}
            />
          )
        })}

        {/* Dots */}
        {nodes.map(({ turn, x, y }) => {
          const isInteractive = turn.render_path === 'interactive' || turn.videoPhase === 'disabled'
          const fill = isInteractive
            ? (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)')
            : turn.videoPhase === 'ready'
              ? '#16a34a'
              : turn.videoPhase === 'error'
                ? '#dc2626'
                : '#ea6a0a'

          return (
            <circle
              key={turn.id}
              cx={x + PAD} cy={y + PAD}
              r={DOT_R}
              fill={fill}
              stroke={ringColor}
              strokeWidth={1}
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onClick={() => onNavigate?.(turn.tempId)}
            >
              <title>{turn.prompt || 'Untitled'}</title>
            </circle>
          )
        })}
      </svg>
    </Box>
  )
}
