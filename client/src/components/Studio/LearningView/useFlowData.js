import { useMemo, useRef, useEffect } from 'react'
import dagre from 'dagre'

export const NODE_W             = 300
export const INTERACTIVE_NODE_H = 196
export const VIDEO_NODE_H       = 336
export const NODE_H             = INTERACTIVE_NODE_H   // compat alias for ConversationMiniTree

export function getNodeHeight(turn) {
  if (!turn || turn.isLoading)                         return INTERACTIVE_NODE_H
  if (turn.render_path === 'interactive')              return INTERACTIVE_NODE_H
  if (turn.render_path && turn.render_path !== 'interactive') return VIDEO_NODE_H
  return INTERACTIVE_NODE_H
}

function layoutWithDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 })

  nodes.forEach((n) => {
    const h = getNodeHeight(n.data?.turn)
    g.setNode(n.id, { width: NODE_W, height: h })
  })
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    const h = getNodeHeight(n.data?.turn)
    return { ...n, position: { x: x - NODE_W / 2, y: y - h / 2 } }
  })
}

export function useFlowData(turns, onAsk, defaultModel, defaultVideoEnabled, defaultNotesEnabled, selectedNodeId = null) {
  const onAskRef = useRef(onAsk)
  useEffect(() => { onAskRef.current = onAsk }, [onAsk])

  return useMemo(() => {
    const valid = turns.filter((t) => t.id || t.isLoading)
    if (!valid.length) return { nodes: [], edges: [] }

    const nodeId = (t) => t.id || t.tempId
    const byId   = Object.fromEntries(valid.map((t) => [nodeId(t), t]))
    valid.forEach((t) => { if (t.id) byId[t.id] = t })

    // Count direct children per turn
    const followUpCounts = {}
    valid.forEach((t) => {
      if (t.parentSessionId) {
        followUpCounts[t.parentSessionId] = (followUpCounts[t.parentSessionId] || 0) + 1
      }
    })

    // Most recently completed turn
    const completed = valid.filter((t) => !t.isLoading && t.id)
    const latestId  = completed.length
      ? completed.reduce((a, b) => ((a.turn_index ?? 0) >= (b.turn_index ?? 0) ? a : b)).id
      : null

    // eslint-disable-next-line react-hooks/refs
    const nodes = valid.map((turn) => ({
      id:       nodeId(turn),
      type:     'sessionNode',
      position: { x: 0, y: 0 },
      data: {
        turn,
        onAsk:               onAskRef.current,
        defaultModel,
        defaultVideoEnabled,
        defaultNotesEnabled,
        followUpCount:       followUpCounts[nodeId(turn)] || 0,
        isLatest:            nodeId(turn) === latestId,
        isSelected:          selectedNodeId != null && (nodeId(turn) === selectedNodeId),
      },
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
  }, [turns, defaultModel, defaultVideoEnabled, defaultNotesEnabled, selectedNodeId])
}
