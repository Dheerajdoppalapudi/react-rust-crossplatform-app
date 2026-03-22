import { useState } from 'react'
import { Box, IconButton, Typography, Tooltip, useTheme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Canvas    from './Canvas'
import NodeModal from './NodeModal'

/**
 * LearningView — full-screen focus canvas (position: fixed overlay).
 *
 * Props:
 *   turns          — flat turns array from Studio
 *   onExit         — switch back to chat mode
 *   onAskFromLearn — ({ question, sessionId, frameIndex, caption }) → handled by Studio
 */
export default function LearningView({ turns, onExit, onAskFromLearn }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [selectedNode, setSelectedNode] = useState(null)

  const handleNodeClick = (node) => {
    // Always use the freshest turn data from the turns array
    const fresh = turns.find((t) => t.id === node.id) || node
    setSelectedNode(fresh)
  }

  const handleAsk = ({ question, sessionId, frameIndex, caption }) => {
    setSelectedNode(null)
    onAskFromLearn?.({ question, sessionId, frameIndex, caption })
  }

  return (
    <Box sx={{
      position:      'fixed',
      inset:         0,
      zIndex:        1300,
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* ── Floating toolbar (top-left) ────────────────────────────────────── */}
      <Box sx={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Tooltip title="Back to chat" placement="right">
          <IconButton
            onClick={onExit}
            size="small"
            sx={{
              bgcolor:        isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
              border:         `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0'}`,
              backdropFilter: 'blur(10px)',
              boxShadow:      '0 2px 10px rgba(0,0,0,0.14)',
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.14)' : '#fff' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{
          px:             1.5, py: 0.6,
          bgcolor:        isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)',
          border:         `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          borderRadius:   '8px',
          backdropFilter: 'blur(10px)',
          boxShadow:      '0 2px 10px rgba(0,0,0,0.1)',
        }}>
          <Typography sx={{
            fontSize: 11.5, fontWeight: 700,
            letterSpacing: '0.04em',
            color: theme.palette.text.primary,
          }}>
            Learning Canvas
          </Typography>
        </Box>
      </Box>

      {/* ── Hint pill (bottom-center) ──────────────────────────────────────── */}
      <Box sx={{
        position:       'absolute', bottom: 20, left: '50%',
        transform:      'translateX(-50%)', zIndex: 10,
        px: 2, py: 0.6,
        bgcolor:        isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.8)',
        border:         `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
        borderRadius:   '20px',
        backdropFilter: 'blur(8px)',
        pointerEvents:  'none',
      }}>
        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary }}>
          Click a node to explore · Drag to reposition · Scroll to zoom
        </Typography>
      </Box>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <Canvas turns={turns} onNodeClick={handleNodeClick} />

      {/* ── Node detail modal ──────────────────────────────────────────────── */}
      {selectedNode && (
        <NodeModal
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onAsk={handleAsk}
        />
      )}
    </Box>
  )
}
