import { useMemo } from 'react'
import dagre from 'dagre'

export const NODE_W = 260
export const NODE_H = 200   // thumbnail(146) + content(54)

function layoutWithDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 70, ranksep: 120 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } }
  })
}

/**
 * Converts the flat `turns` array into React Flow nodes + edges.
 * Dagre handles the hierarchical layout automatically.
 */
export function useFlowData(turns, onAsk, defaultModel, defaultVideoEnabled) {
  return useMemo(() => {
    // Include loading turns (id: null) using tempId as a placeholder node ID
    const valid = turns.filter((t) => t.id || t.isLoading)
    if (!valid.length) return { nodes: [], edges: [] }

    const nodeId = (t) => t.id || t.tempId
    const byId   = Object.fromEntries(valid.map((t) => [nodeId(t), t]))
    // Also index by real id so parent lookups work for loading turns
    valid.forEach((t) => { if (t.id) byId[t.id] = t })

    const nodes = valid.map((turn) => ({
      id:       nodeId(turn),
      type:     'sessionNode',
      position: { x: 0, y: 0 },   // dagre fills this in
      data:     { turn, onAsk, defaultModel, defaultVideoEnabled },
    }))

    const edges = valid
      .filter((t) => t.parentSessionId && byId[t.parentSessionId])
      .map((turn) => ({
        id:     `${turn.parentSessionId}→${nodeId(turn)}`,
        source: turn.parentSessionId,
        target: nodeId(turn),
        type:   'flowEdge',
        data:   { isFrame: turn.parentFrameIndex != null, isLoading: !!turn.isLoading },
      }))

    return { nodes: layoutWithDagre(nodes, edges), edges }
  }, [turns])
}
