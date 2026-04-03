import { getBezierPath } from 'reactflow'

export default function FlowEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data, markerEnd, style,
}) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const isFrame = data?.isFrame

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={path}
      fill="none"
      stroke={isFrame ? style?.stroke : 'rgba(150,150,150,0.35)'}
      strokeWidth={isFrame ? 1.5 : 1}
      strokeDasharray={isFrame ? undefined : '5 4'}
      opacity={isFrame ? 0.7 : 0.5}
      markerEnd={markerEnd}
    />
  )
}
