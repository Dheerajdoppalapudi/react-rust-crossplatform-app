import { getBezierPath } from 'reactflow'

/**
 * Custom bezier edge.
 * Frame-branches → solid primary colour + soft glow layer behind.
 * Follow-ups     → dashed, muted.
 */
export default function FlowEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data, markerEnd, style,
}) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const isFrame = data?.isFrame
  const color   = style?.stroke || '#4f6eff'

  return (
    <>
      {/* Soft glow behind frame-branch edges */}
      {isFrame && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={10}
          opacity={0.1}
        />
      )}

      {/* Main stroke */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        fill="none"
        stroke={isFrame ? color : 'rgba(150,150,150,0.45)'}
        strokeWidth={isFrame ? 2 : 1.5}
        strokeDasharray={isFrame ? undefined : '6 4'}
        opacity={isFrame ? 0.85 : 0.5}
        markerEnd={markerEnd}
      />
    </>
  )
}
