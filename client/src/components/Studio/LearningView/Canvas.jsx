import { useEffect, useCallback } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Box, useTheme } from '@mui/material'
import { useFlowData } from './useFlowData'
import SessionNode from './SessionNode'
import FlowEdge    from './FlowEdge'
import AskNode     from './AskNode'
import { PALETTE } from '../../../theme/tokens.js'

const nodeTypes = { sessionNode: SessionNode, askNode: AskNode }
const edgeTypes = { flowEdge: FlowEdge }

export default function Canvas({ turns, onNodeClick, onAsk }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const primary = theme.palette.primary.main

  const { nodes: layoutNodes, edges: layoutEdges } = useFlowData(turns, onAsk)

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Sync node positions and data when layout changes.
  // Ghost nodes (ask_ghost_ prefix) are preserved across syncs.
  useEffect(() => {
    setNodes((prev) => {
      const prevById   = Object.fromEntries(prev.map((n) => [n.id, n]))
      const ghostNodes = prev.filter((n) => n.id.startsWith('ask_ghost_'))
      return [
        ...layoutNodes.map((ln) => {
          const existing = prevById[ln.id]
          return existing
            ? { ...existing, data: ln.data }  // keep position, refresh data
            : ln                              // new node — use dagre position
        }),
        ...ghostNodes,
      ]
    })
  }, [layoutNodes, setNodes])

  // Apply theme colours to edges separately so a theme change doesn't re-sync positions.
  // Ghost edges (ask_edge_ prefix) are preserved.
  useEffect(() => {
    setEdges((prev) => {
      const ghostEdges = prev.filter((e) => e.id.startsWith('ask_edge_'))
      return [
        ...layoutEdges.map((e) => {
          const solid = e.data?.isFrame || !e.data?.isLoading
          return {
            ...e,
            style: {
              stroke:          solid ? (e.data?.isFrame ? primary : 'rgba(180,180,180,0.85)') : 'rgba(150,150,150,0.45)',
              strokeWidth:     solid ? (e.data?.isFrame ? 2.5 : 2) : 1.5,
              strokeDasharray: solid ? undefined : '5 4',
            },
            markerEnd: {
              type:  'arrowclosed',
              color: solid ? (e.data?.isFrame ? primary : 'rgba(150,150,150,0.6)') : 'rgba(150,150,150,0.4)',
            },
          }
        }),
        ...ghostEdges,
      ]
    })
  }, [layoutEdges, primary, setEdges])

  const handleNodeClick = useCallback((_, rfNode) => {
    if (rfNode.type === 'askNode') return
    if (rfNode.data?.turn?.isLoading) return
    const turn = turns.find((t) => t.id === rfNode.id) || rfNode.data.turn
    onNodeClick?.(turn)
  }, [turns, onNodeClick])

  return (
    <Box sx={{
      flex: 1,
      '& .react-flow__controls': {
        boxShadow: 'none',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderWarm}`,
        borderRadius: '10px', overflow: 'hidden',
        bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
      },
      '& .react-flow__controls-button': {
        bgcolor:     isDark ? PALETTE.darkSurface : PALETTE.ivory,
        color:       isDark ? 'rgba(255,255,255,0.7)' : PALETTE.charcoalWarm,
        borderColor: isDark ? PALETTE.borderDark : PALETTE.borderWarm,
        '&:hover': { bgcolor: isDark ? PALETTE.darkSubsurface : PALETTE.warmSand },
      },
      '& .react-flow__minimap': {
        borderRadius: '10px',
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderWarm}`,
        overflow: 'hidden',
      },
      '& .react-flow__attribution': { display: 'none' },
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: isDark ? PALETTE.nearBlack : PALETTE.parchment }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1}
          color={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'} />
        <Controls />
        <MiniMap
          nodeColor={isDark ? PALETTE.dividerDark : PALETTE.borderWarm}
          maskColor={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(245,244,237,0.7)'}
          style={{ background: isDark ? PALETTE.darkSurface : PALETTE.ivory }}
        />
      </ReactFlow>
    </Box>
  )
}
