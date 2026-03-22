import { useEffect } from 'react'
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

const nodeTypes = { sessionNode: SessionNode }
const edgeTypes = { flowEdge: FlowEdge }

export default function Canvas({ turns, onNodeClick }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const primary = theme.palette.primary.main

  const { nodes: layoutNodes, edges: layoutEdges } = useFlowData(turns)

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Sync when layout changes — preserve dragged positions for existing nodes,
  // use dagre positions for new nodes, refresh data (framesData, videoPhase) always.
  useEffect(() => {
    setNodes((prev) => {
      const prevById = Object.fromEntries(prev.map((n) => [n.id, n]))
      return layoutNodes.map((ln) => {
        const existing = prevById[ln.id]
        return existing
          ? { ...existing, data: ln.data }       // keep position, refresh data
          : ln                                    // new node — use dagre position
      })
    })

    // Apply theme colours to edges
    setEdges(layoutEdges.map((e) => ({
      ...e,
      style: {
        stroke:          e.data?.isFrame ? primary : 'rgba(150,150,150,0.4)',
        strokeWidth:     e.data?.isFrame ? 2       : 1.5,
        strokeDasharray: e.data?.isFrame ? undefined : '5 4',
      },
      markerEnd: {
        type:  'arrowclosed',
        color: e.data?.isFrame ? primary : 'rgba(150,150,150,0.5)',
      },
    })))
  }, [layoutNodes, layoutEdges, primary])   // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeClick = (_, rfNode) => {
    const turn = turns.find((t) => t.id === rfNode.id) || rfNode.data.turn
    onNodeClick?.(turn)
  }

  return (
    <Box sx={{
      flex: 1,
      // Style RF's built-in controls to match the app theme
      '& .react-flow__controls': {
        boxShadow: 'none',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        bgcolor: isDark ? '#1a1a1a' : '#fff',
      },
      '& .react-flow__controls-button': {
        bgcolor:     isDark ? '#1a1a1a' : '#fff',
        color:       isDark ? 'rgba(255,255,255,0.7)' : '#374151',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
        '&:hover': { bgcolor: isDark ? '#252525' : '#f9fafb' },
      },
      '& .react-flow__minimap': {
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
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
        style={{ background: isDark ? '#0d0d0d' : '#f4f6f9' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'}
        />
        <Controls />
        <MiniMap
          nodeColor={isDark ? '#2a2a2a' : '#e2e8f0'}
          maskColor={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(240,242,245,0.7)'}
          style={{ background: isDark ? '#1a1a1a' : '#fff' }}
        />
      </ReactFlow>
    </Box>
  )
}
