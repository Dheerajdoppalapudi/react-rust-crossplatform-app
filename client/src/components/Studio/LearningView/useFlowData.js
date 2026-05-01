import { useMemo, useRef, useEffect } from 'react'
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
 *
 * Dep strategy:
 *   - `turns`, `defaultModel`, `defaultVideoEnabled` are in the memo deps so
 *     structural changes (new turn, model/video toggle) correctly re-layout.
 *   - `onAsk` is kept behind a ref so useCallback churn in LearningView
 *     (which recreates onAsk on every turn update) doesn't trigger unnecessary
 *     dagre re-runs. Canvas.jsx's data-sync effect propagates the fresh ref
 *     value to existing nodes without touching their positions.
 */
export function useFlowData(turns, onAsk, defaultModel, defaultVideoEnabled) {
  const onAskRef = useRef(onAsk)
  useEffect(() => { onAskRef.current = onAsk }, [onAsk])

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
      data:     { turn, onAsk: onAskRef.current, defaultModel, defaultVideoEnabled },
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
  }, [turns, defaultModel, defaultVideoEnabled])
}
