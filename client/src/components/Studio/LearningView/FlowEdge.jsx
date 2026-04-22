import { useStore, getBezierPath, Position } from 'reactflow'
import { NODE_W, NODE_H } from './useFlowData'

/** Returns the best source + target handle positions based on relative node placement. */
function getAdaptivePositions(sourceNode, targetNode) {
  const sx = (sourceNode.positionAbsolute?.x ?? sourceNode.position.x) + NODE_W / 2
  const sy = (sourceNode.positionAbsolute?.y ?? sourceNode.position.y) + NODE_H / 2
  const tx = (targetNode.positionAbsolute?.x ?? targetNode.position.x) + NODE_W / 2
  const ty = (targetNode.positionAbsolute?.y ?? targetNode.position.y) + NODE_H / 2
  const dx = tx - sx
  const dy = ty - sy

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { srcPos: Position.Right,  tgtPos: Position.Left }
      : { srcPos: Position.Left,   tgtPos: Position.Right }
  }
  return dy > 0
    ? { srcPos: Position.Bottom, tgtPos: Position.Top }
    : { srcPos: Position.Top,    tgtPos: Position.Bottom }
}

export default function FlowEdge({ id, source, target, data, markerEnd, style }) {
  const sourceNode = useStore((s) => s.nodeInternals.get(source))
  const targetNode = useStore((s) => s.nodeInternals.get(target))

  if (!sourceNode || !targetNode) return null

  const { srcPos, tgtPos } = getAdaptivePositions(sourceNode, targetNode)

  const srcX = (sourceNode.positionAbsolute?.x ?? sourceNode.position.x) + (srcPos === Position.Right ? NODE_W : srcPos === Position.Left ? 0 : NODE_W / 2)
  const srcY = (sourceNode.positionAbsolute?.y ?? sourceNode.position.y) + (srcPos === Position.Bottom ? NODE_H : srcPos === Position.Top ? 0 : NODE_H / 2)
  const tgtX = (targetNode.positionAbsolute?.x ?? targetNode.position.x) + (tgtPos === Position.Right ? NODE_W : tgtPos === Position.Left ? 0 : NODE_W / 2)
  const tgtY = (targetNode.positionAbsolute?.y ?? targetNode.position.y) + (tgtPos === Position.Bottom ? NODE_H : tgtPos === Position.Top ? 0 : NODE_H / 2)

  const [path] = getBezierPath({
    sourceX: srcX, sourceY: srcY, sourcePosition: srcPos,
    targetX: tgtX, targetY: tgtY, targetPosition: tgtPos,
  })

  const isFrame   = data?.isFrame
  const isLoading = data?.isLoading
  const stroke    = style?.stroke ?? 'rgba(150,150,150,0.55)'
  const markerId  = `arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,10 L10,5 z" fill={stroke} />
        </marker>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={isFrame ? 2.5 : 2}
        strokeDasharray={isLoading && !isFrame ? '5 4' : undefined}
        opacity={isFrame ? 1 : 0.9}
        markerEnd={`url(#${markerId})`}
      />
    </>
  )
}
