import { useState } from 'react'
import { Box, IconButton, Typography, Tooltip, useTheme, Button, CircularProgress } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MergeIcon from '@mui/icons-material/MergeType'
import Canvas    from './Canvas'
import NodeModal from './NodeModal'
import MergedVideoModal   from './MergedVideoModal'
import MergeLoadingModal  from './MergeLoadingModal'
import { api } from '../../../services/api'

/**
 * LearningView — full-screen focus canvas (position: fixed overlay).
 *
 * Props:
 *   turns          — flat turns array from Studio
 *   conversationId — id of the active conversation (for merging)
 *   onExit         — switch back to chat mode
 *   onAskFromLearn — ({ question, sessionId, frameIndex, caption }) → handled by Studio
 */
export default function LearningView({ turns, conversationId, onExit, onAskFromLearn }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [selectedNode, setSelectedNode] = useState(null)
  const [merging, setMerging]           = useState(false)
  const [mergeResult, setMergeResult]   = useState(null)
  const [mergeError, setMergeError]     = useState(null)

  const handleNodeClick = (node) => {
    // Always use the freshest turn data from the turns array
    const fresh = turns.find((t) => t.id === node.id) || node
    setSelectedNode(fresh)
  }

  const handleAsk = ({ question, sessionId, frameIndex, caption }) => {
    setSelectedNode(null)
    onAskFromLearn?.({ question, sessionId, frameIndex, caption })
  }

  const handleMerge = async () => {
    setMerging(true)
    setMergeError(null)
    try {
      const result = await api.mergeConversation(conversationId)
      setMergeResult(result)
    } catch (e) {
      setMergeError(e.message || 'Merge failed')
    } finally {
      setMerging(false)
    }
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

      {/* ── Merge button (top-right) ────────────────────────────────────────── */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1 }}>
        {mergeError && (
          <Typography sx={{ fontSize: 11, color: '#f87171', bgcolor: 'rgba(239,68,68,0.12)', px: 1.5, py: 0.5, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
            {mergeError}
          </Typography>
        )}
        <Button
          onClick={mergeResult ? () => setMergeResult(mergeResult) : handleMerge}
          disabled={merging}
          size="small"
          variant="contained"
          startIcon={merging ? <CircularProgress size={12} color="inherit" /> : <MergeIcon sx={{ fontSize: 14 }} />}
          sx={{
            fontSize: 11.5, fontWeight: 700, px: 1.75, py: 0.6,
            borderRadius: '8px', textTransform: 'none',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          {merging ? 'Merging\u2026' : mergeResult ? 'View Merged' : 'Merge Videos'}
        </Button>
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

      {/* ── Merge loading modal ─────────────────────────────────────────────── */}
      <MergeLoadingModal open={merging} sessionCount={turns.filter((t) => t.id && t.videoPhase === 'ready').length} />

      {/* ── Merged video modal ──────────────────────────────────────────────── */}
      {mergeResult && (
        <MergedVideoModal
          open={true}
          onClose={() => setMergeResult(null)}
          mergedVideoUrl={api.getMergedVideoUrl(conversationId)}
          sessions={mergeResult.sessions}
        />
      )}
    </Box>
  )
}
