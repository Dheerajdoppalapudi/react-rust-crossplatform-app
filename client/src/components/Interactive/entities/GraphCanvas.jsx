import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme, Dialog, DialogContent } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseIcon from '@mui/icons-material/Close'
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
      data: {
        label:    n.label ?? n.id,
        metadata: n.metadata ?? null,
      },
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
      id:       e.id ?? `${e.source}-${e.target}`,
      source:   e.source,
      target:   e.target,
      label:    e.label,
      animated: e.animated ?? false,
      type:     e.type ?? 'smoothstep',
      markerEnd: directed ? { type: MarkerType.ArrowClosed, color: isHighlighted ? BRAND.primary : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)') } : undefined,
      style: {
        stroke:      isHighlighted ? BRAND.primary : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        transition:  'stroke 0.25s ease, stroke-width 0.25s ease',
      },
      labelStyle:   { fontSize: TYPOGRAPHY.sizes.caption, fill: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: TYPOGRAPHY.fontFamily },
      labelBgStyle: { fill: isDark ? PALETTE.darkSurface : '#ffffff', fillOpacity: 0.8 },
    }
  })
}

function GraphInner({ rawNodes, rawEdges, layout, directed, height, showMinimap, showControls, stepHighlights, nodeColors, caption, entityId, resetKey }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const stepIndex = useSceneStore(s => s.getStep(entityId))

  const [hoveredNodeId, setHoveredNodeId] = useState(null)

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
  }, [rawNodes, rawEdges, layout, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const rfNodes = useMemo(
    () => buildNodes(laidOutNodes, highlightedNodeIds, nodeColors, isDark),
    [laidOutNodes, highlightedNodeIds, nodeColors, isDark]
  )

  const rfEdges = useMemo(
    () => buildEdges(rawEdges, highlightedEdgeIds, directed, isDark),
    [rawEdges, highlightedEdgeIds, directed, isDark]
  )

  const [nodes, , onNodesChange] = useNodesState(rfNodes)
  const [, , onEdgesChange]      = useEdgesState(rfEdges)

  const displayNodes = rfNodes.map(n => ({
    ...n,
    ...nodes.find(nn => nn.id === n.id && nn.dragging ? { position: nn.position } : {}),
  }))

  const hoveredNode = hoveredNodeId ? rawNodes.find(n => n.id === hoveredNodeId) : null

  const isFluid = height === '100%'

  return (
    <Box sx={isFluid ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } : {}}>
      <Box sx={{
        height: isFluid ? '100%' : height,
        flex: isFluid ? 1 : undefined,
        position: 'relative',
        borderRadius: isFluid ? 0 : `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: isFluid ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
      }}>
        <ReactFlow
          nodes={displayNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={(_, node) => { if (node.data.metadata) setHoveredNodeId(node.id) }}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
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

        {/* Hover tooltip for node metadata */}
        {hoveredNode?.metadata && (
          <Box sx={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            backgroundColor: isDark ? 'rgba(13,17,23,0.95)' : 'rgba(255,255,255,0.97)',
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
            borderRadius: `${RADIUS.md}px`,
            px: 1.5, py: 0.75, maxWidth: 320, zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
              lineHeight: 1.45,
            }}>
              {hoveredNode.metadata}
            </Typography>
          </Box>
        )}
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
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [resetKey,  setResetKey]  = useState(0)
  const [expanded,  setExpanded]  = useState(false)
  const handleReset   = useCallback(() => setResetKey(k => k + 1), [])
  const handleExpand  = useCallback(() => setExpanded(true),        [])
  const handleCollapse= useCallback(() => setExpanded(false),       [])

  if (!nodes.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        graph_canvas: "nodes" array is required
      </Box>
    )
  }

  const sharedProps = {
    rawNodes: nodes, rawEdges: edges, layout, directed,
    showMinimap, showControls, stepHighlights, nodeColors,
    entityId, resetKey,
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mb: 0.5 }}>
        <Tooltip title="Reset layout">
          <IconButton size="small" onClick={handleReset} aria-label="Reset graph layout"
            sx={{ color: 'text.disabled', width: 26, height: 26 }}>
            <RefreshIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Expand">
          <IconButton size="small" onClick={handleExpand} aria-label="Expand graph"
            sx={{ color: 'text.disabled', width: 26, height: 26 }}>
            <OpenInFullIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Inline view */}
      <GraphInner key={`inline-${resetKey}`} height={height} caption={caption} {...sharedProps} />

      {/* Expanded Dialog — fresh mount so ReactFlow remeasures the new container */}
      <Dialog
        open={expanded}
        onClose={handleCollapse}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '90vw', height: '85vh',
            maxWidth: 'none', maxHeight: 'none',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          },
        }}
      >
        {/* Dialog header */}
        <Box sx={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          px: 1.5, py: 0.75,
          borderBottom: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        }}>
          <Tooltip title="Close">
            <IconButton size="small" onClick={handleCollapse}
              sx={{ color: 'text.secondary', width: 28, height: 28 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Full-size graph — key differs from inline so ReactFlow gets a fresh instance */}
        <DialogContent sx={{ flex: 1, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <GraphInner
            key={`expanded-${resetKey}-${expanded}`}
            height="100%"
            caption={caption}
            {...sharedProps}
            showMinimap={true}
          />
        </DialogContent>
      </Dialog>
    </Box>
  )
}
