import { useState, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { Box, Typography, Tooltip, useTheme, CircularProgress } from '@mui/material'
import MovieOutlinedIcon     from '@mui/icons-material/MovieOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import AddIcon               from '@mui/icons-material/Add'
import NotesOutlinedIcon     from '@mui/icons-material/NotesOutlined'
import { useMediaUrl } from '../../../hooks/useMediaUrl'
import { NODE_W, NODE_H } from './useFlowData'
import { BRAND, PALETTE } from '../../../theme/tokens.js'

const THUMB_H  = Math.round(NODE_W * 9 / 16)  // 146
const ASK_W    = 340   // must match AskNode width
const ASK_H    = 138   // approximate AskNode height

export default function SessionNode({ data }) {
  const { turn }                      = data
  const theme                         = useTheme()
  const isDark                        = theme.palette.mode === 'dark'
  const primary                       = theme.palette.primary.main
  const { setNodes, setEdges, getNode } = useReactFlow()

  const [imgError,    setImgError]    = useState(false)
  const [thumbHover,  setThumbHover]  = useState(false)
  const [nodeHovered, setNodeHovered] = useState(false)
  const [isOpen,      setIsOpen]      = useState(false)
  const [duration,    setDuration]    = useState(null)

  const isTextTurn  = turn.framesData?.render_path === 'text' || turn.render_path === 'text'
  const frameCount  = turn.framesData?.captions?.length || turn.frame_count || 0
  const intentLabel = (turn.intent_type || '').replace(/_/g, ' ')
  const isReady     = !isTextTurn && turn.videoPhase === 'ready'

  const { videoUrl, getFrameUrl } = useMediaUrl(turn.id)
  const frameUrl = getFrameUrl(0)

  useEffect(() => {
    if (!turn.id || !isReady || !videoUrl) return
    const v = document.createElement('video')
    v.src = videoUrl
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const s = Math.round(v.duration)
      setDuration(s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)
    }
  }, [turn.id, isReady, videoUrl])

  const ghostId   = `ask_ghost_${turn.id}`
  const edgeId    = `ask_edge_${turn.id}`
  const edgeColor = isDark ? 'rgba(180,180,180,0.45)' : 'rgba(80,80,80,0.35)'

  const removeGhost = () => {
    setNodes((ns) => ns
      .filter((n) => n.id !== ghostId)
      .map((n) => n.id === turn.id ? { ...n, zIndex: 0 } : n)
    )
    setEdges((es) => es.filter((e) => e.id !== edgeId))
    setIsOpen(false)
  }

  const openPanel = (e) => {
    e.stopPropagation()
    const self = getNode(turn.id)
    if (!self) return

    // Elevate this node + add ghost ask-node to its right
    setNodes((ns) => [
      ...ns.map((n) => n.id === turn.id ? { ...n, zIndex: 999 } : n),
      {
        id:         ghostId,
        type:       'askNode',
        position:   {
          x: self.position.x + NODE_W + 80,
          y: self.position.y + (NODE_H - ASK_H) / 2,
        },
        data: {
          onSubmit: (q) => {
            removeGhost()
            data.onAsk?.({ question: q, sessionId: turn.id })
          },
          onCancel: removeGhost,
        },
        draggable:  true,
        selectable: false,
      },
    ])

    // React Flow dashed edge from the right-side handle of this node
    setEdges((es) => [...es, {
      id:           edgeId,
      source:       turn.id,
      sourceHandle: 'ask-right',
      target:       ghostId,
      type:         'default',
      style:        { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5 4' },
      markerEnd:    { type: 'arrowclosed', width: 20, height: 20, color: edgeColor },
      animated:     false,
    }])

    setIsOpen(true)
  }

  const tooltipContent = (
    <Box>
      <Typography sx={{ fontSize: 11, lineHeight: 1.5 }}>{turn.prompt || 'Untitled'}</Typography>
      <Typography sx={{ fontSize: 10, opacity: 0.6, mt: 0.5 }}>Click to view</Typography>
    </Box>
  )

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (turn.isLoading) {
    const stageLabel = turn.stage === 'planning' ? 'Planning…'
      : turn.stage === 'generating' ? 'Generating…'
      : turn.stage === 'rendering'  ? 'Rendering…'
      : 'Processing…'
    return (
      <>
        <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        <Box sx={{
          width:        NODE_W,
          height:       NODE_H,
          borderRadius: '10px',
          border:       `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e8ecf2'}`,
          bgcolor:      isDark ? PALETTE.darkSurface : PALETTE.ivory,
          overflow:     'hidden',
          display:      'flex',
          flexDirection:'column',
          alignItems:   'center',
          justifyContent: 'center',
          gap:          1.5,
          boxShadow:    isDark
            ? '0 2px 8px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Shimmer thumbnail placeholder */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: isDark
              ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)'
              : 'linear-gradient(135deg, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.02) 75%)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 1.8s ease-in-out infinite',
            '@keyframes shimmer': {
              '0%':   { backgroundPosition: '200% 0' },
              '100%': { backgroundPosition: '-200% 0' },
            },
          }} />
          <CircularProgress size={22} thickness={3} sx={{ color: primary, opacity: 0.7, position: 'relative' }} />
          <Box sx={{ position: 'relative', textAlign: 'center', px: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: primary, opacity: 0.8 }}>
              {stageLabel}
            </Typography>
            <Typography sx={{ fontSize: 10, color: theme.palette.text.secondary, mt: 0.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {turn.prompt || 'Untitled'}
            </Typography>
          </Box>
        </Box>
      </>
    )
  }

  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      {/* Dedicated right-side handle for the ask edge */}
      <Handle type="source" id="ask-right" position={Position.Right}  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Outer wrapper — position: relative for "+" button */}
      <Box
        sx={{ position: 'relative' }}
        onMouseEnter={() => setNodeHovered(true)}
        onMouseLeave={() => { if (!isOpen) setNodeHovered(false) }}
      >
        {/* ── Grey "+" button — bottom-right, fades in on hover ─────────────── */}
        <Tooltip title="Ask a follow-up" placement="right" arrow>
          <Box
            onClick={openPanel}
            sx={{
              position: 'absolute',
              bottom: 8, right: 8,
              width: 22, height: 22,
              zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px',
              cursor: 'pointer',
              opacity: nodeHovered && !isOpen ? 1 : 0,
              pointerEvents: nodeHovered && !isOpen ? 'all' : 'none',
              bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              transition: 'opacity 0.18s, background 0.15s',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.09)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)' }} />
          </Box>
        </Tooltip>

        {/* ── Card ──────────────────────────────────────────────────────────── */}
        <Tooltip title={tooltipContent} placement="top" arrow enterDelay={400}>
          <Box sx={{
            width:        NODE_W,
            height:       NODE_H,
            borderRadius: '10px',
            border:       `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e8ecf2'}`,
            bgcolor:      isDark ? PALETTE.darkSurface : PALETTE.ivory,
            overflow:     'hidden',
            cursor:       'pointer',
            boxShadow:    isDark
              ? '0 2px 8px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.5)'
              : '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
            transition:   'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
            '&:hover': {
              borderColor: primary,
              transform:   'translateY(-2px)',
              boxShadow:   isDark
                ? `0 0 0 1.5px ${primary}55, 0 16px 48px rgba(0,0,0,0.65)`
                : `0 0 0 1.5px ${primary}44, 0 12px 32px rgba(0,0,0,0.12)`,
            },
          }}>

            {/* Thumbnail */}
            <Box
              onMouseEnter={() => setThumbHover(true)}
              onMouseLeave={() => setThumbHover(false)}
              sx={{ width: '100%', height: THUMB_H, bgcolor: isDark ? PALETTE.nearBlack : PALETTE.warmSand, overflow: 'hidden', position: 'relative' }}
            >
              {isTextTurn ? (
                /* Text-only turn — notes icon placeholder */
                <Box sx={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                }}>
                  <NotesOutlinedIcon sx={{ fontSize: 32, opacity: 0.18, color: theme.palette.text.secondary }} />
                </Box>
              ) : turn.id && !imgError && frameUrl ? (
                <img
                  src={frameUrl}
                  alt="thumbnail"
                  onError={() => setImgError(true)}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    transition: 'transform 0.3s ease',
                    transform: thumbHover ? 'scale(1.04)' : 'scale(1)',
                  }}
                />
              ) : (
                <Box sx={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundImage: isDark
                    ? 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)'
                    : 'linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px)',
                  backgroundSize: '16px 16px',
                }}>
                  <MovieOutlinedIcon sx={{ fontSize: 30, opacity: 0.12, color: theme.palette.text.secondary }} />
                </Box>
              )}

              {!isTextTurn && thumbHover && turn.id && !imgError && frameUrl && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.28)' }}>
                  <PlayCircleOutlineIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.85)' }} />
                </Box>
              )}

              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, pointerEvents: 'none', background: isDark ? `linear-gradient(transparent,${PALETTE.darkSurface})` : `linear-gradient(transparent,${PALETTE.ivory})` }} />

              {/* Badges */}
              <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {intentLabel && (
                  <Box sx={{ px: 0.75, py: 0.3, borderRadius: '20px', bgcolor: 'rgba(75,114,255,0.18)', border: '1px solid rgba(75,114,255,0.4)', backdropFilter: 'blur(6px)' }}>
                    <Typography sx={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: BRAND.accent, textTransform: 'capitalize' }}>{intentLabel}</Typography>
                  </Box>
                )}
                {!isTextTurn && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.3, borderRadius: '20px', bgcolor: isReady ? 'rgba(34,197,94,0.18)' : 'rgba(251,146,60,0.18)', border: `1px solid ${isReady ? 'rgba(34,197,94,0.4)' : 'rgba(251,146,60,0.4)'}`, backdropFilter: 'blur(6px)' }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isReady ? PALETTE.successGreen : PALETTE.warningOrange }} />
                    <Typography sx={{ fontSize: 8, fontWeight: 700, lineHeight: 1, color: isReady ? PALETTE.successGreen : PALETTE.warningOrange }}>
                      {isReady && duration ? duration : isReady ? 'READY' : 'GEN'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Divider */}
            <Box sx={{ height: '1px', bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }} />

            {/* Info */}
            <Box sx={{ px: 1.5, pt: 1, pb: 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.45, color: theme.palette.text.primary, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 0.75 }}>
                {turn.prompt || 'Untitled'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {!isTextTurn && frameCount > 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    {Array.from({ length: Math.min(frameCount, 6) }).map((_, i) => (
                      <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, bgcolor: primary, opacity: 0.5 }} />
                    ))}
                    {frameCount > 6 && <Typography sx={{ fontSize: 9, color: theme.palette.text.secondary }}>+{frameCount - 6}</Typography>}
                    <Typography sx={{ fontSize: 9.5, color: theme.palette.text.secondary, ml: 0.5 }}>{frameCount} slides</Typography>
                  </Box>
                ) : <Box />}
                {intentLabel && (
                  <Typography sx={{ fontSize: 9, fontWeight: 600, px: 0.75, py: 0.25, borderRadius: '5px', textTransform: 'capitalize', flexShrink: 0, bgcolor: isDark ? `${primary}18` : `${primary}12`, color: primary }}>
                    {intentLabel}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Tooltip>
      </Box>
    </>
  )
}
