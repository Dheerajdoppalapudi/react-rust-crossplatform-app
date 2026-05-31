import { useStore, getBezierPath, Position } from 'reactflow'
import { NODE_W, NODE_H } from './useFlowData'

function getAdaptivePositions(sourceNode, targetNode) {
  const srcW = sourceNode.width  ?? NODE_W
  const tgtW = targetNode.width  ?? NODE_W
  const srcH = sourceNode.height ?? NODE_H
  const tgtH = targetNode.height ?? NODE_H

  const sx = (sourceNode.positionAbsolute?.x ?? sourceNode.position.x) + srcW / 2
  const sy = (sourceNode.positionAbsolute?.y ?? sourceNode.position.y) + srcH / 2
  const tx = (targetNode.positionAbsolute?.x ?? targetNode.position.x) + tgtW / 2
  const ty = (targetNode.positionAbsolute?.y ?? targetNode.position.y) + tgtH / 2
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

export default function FlowEdge({ id, source, target, data, style }) {
  const sourceNode = useStore((s) => s.nodeInternals.get(source))
  const targetNode = useStore((s) => s.nodeInternals.get(target))

  if (!sourceNode || !targetNode) return null

  const srcW = sourceNode.width  ?? NODE_W
  const tgtW = targetNode.width  ?? NODE_W
  const srcH = sourceNode.height ?? NODE_H
  const tgtH = targetNode.height ?? NODE_H

  const { srcPos, tgtPos } = getAdaptivePositions(sourceNode, targetNode)

  const srcX = (sourceNode.positionAbsolute?.x ?? sourceNode.position.x)
    + (srcPos === Position.Right ? srcW : srcPos === Position.Left ? 0 : srcW / 2)
  const srcY = (sourceNode.positionAbsolute?.y ?? sourceNode.position.y)
    + (srcPos === Position.Bottom ? srcH : srcPos === Position.Top ? 0 : srcH / 2)
  const tgtX = (targetNode.positionAbsolute?.x ?? targetNode.position.x)
    + (tgtPos === Position.Right ? tgtW : tgtPos === Position.Left ? 0 : tgtW / 2)
  const tgtY = (targetNode.positionAbsolute?.y ?? targetNode.position.y)
    + (tgtPos === Position.Bottom ? tgtH : tgtPos === Position.Top ? 0 : tgtH / 2)

  const [path] = getBezierPath({
    sourceX: srcX, sourceY: srcY, sourcePosition: srcPos,
    targetX: tgtX, targetY: tgtY, targetPosition: tgtPos,
  })

  const isLoading  = data?.isLoading
  const stroke     = style?.stroke ?? 'rgba(150,150,150,0.55)'
  const markerId   = `arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="8" markerHeight="8"
          refX="7" refY="4"
          orient="auto" markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,8 L8,4 z" fill={stroke} />
        </marker>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={style?.strokeWidth ?? 2}
        strokeDasharray={isLoading ? '5 4' : undefined}
        strokeLinecap="round"
        opacity={isLoading ? 0.6 : 0.85}
        markerEnd={`url(#${markerId})`}
      />
    </>
  )
}
