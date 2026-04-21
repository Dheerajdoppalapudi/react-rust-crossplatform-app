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
export function useFlowData(turns, onAsk) {
  return useMemo(() => {
    const valid = turns.filter((t) => t.id)
    if (!valid.length) return { nodes: [], edges: [] }

    const byId = Object.fromEntries(valid.map((t) => [t.id, t]))

    const nodes = valid.map((turn) => ({
      id:       turn.id,
      type:     'sessionNode',
      position: { x: 0, y: 0 },   // dagre fills this in
      data:     { turn, onAsk },
    }))

    const edges = valid
      .filter((t) => t.parentSessionId && byId[t.parentSessionId])
      .map((turn) => ({
        id:     `${turn.parentSessionId}→${turn.id}`,
        source: turn.parentSessionId,
        target: turn.id,
        type:   'flowEdge',
        data:   { isFrame: turn.parentFrameIndex != null },
      }))

    return { nodes: layoutWithDagre(nodes, edges), edges }
  }, [turns, onAsk])
}
