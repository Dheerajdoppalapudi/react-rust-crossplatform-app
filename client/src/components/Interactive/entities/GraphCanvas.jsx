import { useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import ReactFlow, {
  Background, Controls, MiniMap,
  MarkerType,
  useNodesState, useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { useSceneStore } from '../useSceneStore'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

const NODE_W = 140
const NODE_H = 40

function applyDagreLayout(rawNodes, rawEdges, direction) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 })
  rawNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  rawEdges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return rawNodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })
}

function buildNodes(rawNodes, highlightedNodeIds, nodeColors, isDark) {
  return rawNodes.map(n => {
    const isHighlighted = highlightedNodeIds.has(n.id)
    const customColor   = nodeColors?.[n.id]
    return {
      id:       n.id,
      type:     n.type ?? 'default',
      position: n.position ?? { x: n.x ?? 0, y: n.y ?? 0 },
      data: { label: n.label ?? n.id },
      style: {
        fontSize:        TYPOGRAPHY.sizes.caption,
        fontFamily:      TYPOGRAPHY.fontFamily,
        borderRadius:    RADIUS.md,
        padding:         '6px 12px',
        minWidth:        NODE_W,
        textAlign:       'center',
        backgroundColor: isHighlighted
          ? 'rgba(24,71,214,0.18)'
          : customColor
          ? `${customColor}22`
          : (isDark ? PALETTE.darkSubsurface : '#ffffff'),
        border: isHighlighted
          ? `2px solid ${BRAND.primary}`
          : customColor
          ? `1.5px solid ${customColor}`
          : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
        transition: 'all 0.25s ease',
      },
    }
  })
}

function buildEdges(rawEdges, highlightedEdgeIds, directed, isDark) {
  return rawEdges.map(e => {
    const isHighlighted = highlightedEdgeIds.has(e.id)
    return {
      id:           e.id ?? `${e.source}-${e.target}`,
      source:       e.source,
      target:       e.target,
      label:        e.label,
      animated:     e.animated ?? false,
      type:         e.type ?? 'smoothstep',
      markerEnd:    directed ? { type: MarkerType.ArrowClosed, color: isHighlighted ? BRAND.primary : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)') } : undefined,
      style: {
        stroke:      isHighlighted ? BRAND.primary : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        transition:  'stroke 0.25s ease, stroke-width 0.25s ease',
      },
      labelStyle: {
        fontSize:   TYPOGRAPHY.sizes.caption,
        fill:       isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        fontFamily: TYPOGRAPHY.fontFamily,
      },
      labelBgStyle: {
        fill: isDark ? PALETTE.darkSurface : '#ffffff',
        fillOpacity: 0.8,
      },
    }
  })
}

function GraphInner({ rawNodes, rawEdges, layout, directed, height, showMinimap, showControls, stepHighlights, nodeColors, caption, entityId }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const stepIndex = useSceneStore(s => s.getStep(entityId))

  const highlightedNodeIds = useMemo(() => {
    if (!stepHighlights?.length) return new Set()
    const h = stepHighlights[Math.min(stepIndex, stepHighlights.length - 1)]
    return new Set(h?.nodes ?? [])
  }, [stepHighlights, stepIndex])

  const highlightedEdgeIds = useMemo(() => {
    if (!stepHighlights?.length) return new Set()
    const h = stepHighlights[Math.min(stepIndex, stepHighlights.length - 1)]
    return new Set(h?.edges ?? [])
  }, [stepHighlights, stepIndex])

  const laidOutNodes = useMemo(() => {
    if (layout === 'manual') {
      return rawNodes.map(n => ({ ...n, position: { x: n.x ?? 0, y: n.y ?? 0 } }))
    }
    const dir = layout === 'dagre-tb' ? 'TB' : 'LR'
    return applyDagreLayout(rawNodes, rawEdges, dir)
  }, [rawNodes, rawEdges, layout])

  const rfNodes = useMemo(
    () => buildNodes(laidOutNodes, highlightedNodeIds, nodeColors, isDark),
    [laidOutNodes, highlightedNodeIds, nodeColors, isDark]
  )

  const rfEdges = useMemo(
    () => buildEdges(rawEdges, highlightedEdgeIds, directed, isDark),
    [rawEdges, highlightedEdgeIds, directed, isDark]
  )

  const [nodes, , onNodesChange] = useNodesState(rfNodes)
  const [, , onEdgesChange] = useEdgesState(rfEdges)

  // Sync external highlight changes into node/edge state
  const displayNodes = rfNodes.map(n => ({ ...n, ...nodes.find(nn => nn.id === n.id && nn.dragging ? { position: nn.position } : {}) }))
  const displayEdges = rfEdges

  return (
    <Box>
      <Box sx={{ height, borderRadius: `${RADIUS.lg}px`, overflow: 'hidden', border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}` }}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ backgroundColor: isDark ? PALETTE.darkSurface : '#fafafa' }}
        >
          {showControls && <Controls showInteractive={false} style={{ bottom: 8, left: 8 }} />}
          {showMinimap  && <MiniMap nodeColor={n => n.style?.backgroundColor ?? '#eee'} maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} />}
          <Background variant="dots" gap={16} size={1} color={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
        </ReactFlow>
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

export default function GraphCanvas({
  entityId,
  nodes          = [],
  edges          = [],
  layout         = 'dagre-lr',
  directed       = true,
  height         = 340,
  showMinimap    = false,
  showControls   = true,
  stepHighlights,
  nodeColors,
  caption,
}) {
  if (!nodes.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        graph_canvas: "nodes" array is required
      </Box>
    )
  }

  return (
    <GraphInner
      rawNodes={nodes}
      rawEdges={edges}
      layout={layout}
      directed={directed}
      height={height}
      showMinimap={showMinimap}
      showControls={showControls}
      stepHighlights={stepHighlights}
      nodeColors={nodeColors}
      caption={caption}
      entityId={entityId}
    />
  )
}
