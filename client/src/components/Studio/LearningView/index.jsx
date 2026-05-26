import { useState, useCallback } from 'react'
import { Box, IconButton, Typography, Tooltip, useTheme, Button, CircularProgress } from '@mui/material'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import MergeIcon      from '@mui/icons-material/MergeType'
import EditNoteIcon   from '@mui/icons-material/EditNote'
import Canvas         from './Canvas'
import NodeModal      from './NodeModal'
import MergedVideoModal   from './MergedVideoModal'
import MergeLoadingModal  from './MergeLoadingModal'
import UserNotesPanel from '../UserNotesPanel/index'
import { api } from '../../../services/api'
import { getConversationMediaToken } from '../../../services/mediaToken'
import { API_BASE } from '../../../constants/api.js'

export default function LearningView({ turns, conversationId, onExit, onAskFromLearn, onGenerateFromCanvas, defaultModel, defaultVideoEnabled, notesEnabled, userNotesOpen, onToggleUserNotes }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [selectedNode,    setSelectedNode]    = useState(null)
  const [merging,         setMerging]         = useState(false)
  const [mergeResult,     setMergeResult]     = useState(null)
  const [showMergedModal, setShowMergedModal] = useState(false)
  const [mergeError,      setMergeError]      = useState(null)
  const [mergedVideoUrl,  setMergedVideoUrl]  = useState(null)

  const handleNodeClick = useCallback((node) => {
    const fresh = turns.find((t) => t.id === node.id || t.tempId === node.tempId) || node
    setSelectedNode(fresh)
  }, [turns])

  const handleAsk = useCallback(({ question, sessionId, frameIndex, caption }) => {
    setSelectedNode(null)
    onAskFromLearn?.({ question, sessionId, frameIndex, caption })
  }, [onAskFromLearn])

  const handleCanvasAsk = useCallback(({ question, sessionId, model, videoEnabled, notesEnabled: askNotesEnabled }) => {
    onGenerateFromCanvas?.({ question, sessionId, model, videoEnabled, notesEnabled: askNotesEnabled })
  }, [onGenerateFromCanvas])

  const handleMerge = useCallback(async () => {
    setMerging(true)
    setMergeError(null)
    try {
      const result = await api.mergeConversation(conversationId)
      setMergeResult(result)
      setShowMergedModal(true)
      const token = await getConversationMediaToken(conversationId)
      setMergedVideoUrl(`${API_BASE}/api/v1/conversations/${conversationId}/merged_video?token=${token}`)
    } catch (e) {
      setMergeError(e.message || 'Merge failed')
    } finally {
      setMerging(false)
    }
  }, [conversationId])

  const readyCount = turns.filter((t) => t.id && t.videoPhase === 'ready').length

  return (
    <Box sx={{
      position:      'fixed',
      inset:         0,
      zIndex:        1300,
      display:       'flex',
      flexDirection: 'column',
    }}>
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

      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1 }}>
        {mergeError && (
          <Typography sx={{ fontSize: 11, color: '#f87171', bgcolor: 'rgba(239,68,68,0.12)', px: 1.5, py: 0.5, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
            {mergeError}
          </Typography>
        )}
        <Tooltip title="My Notes" placement="bottom">
          <IconButton
            size="small"
            onClick={onToggleUserNotes}
            aria-pressed={userNotesOpen}
            sx={{
              bgcolor: userNotesOpen
                ? (isDark ? 'rgba(79,110,255,0.2)' : 'rgba(24,71,214,0.1)')
                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)'),
              border: `1px solid ${userNotesOpen
                ? (isDark ? 'rgba(79,110,255,0.5)' : 'rgba(24,71,214,0.3)')
                : (isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0')}`,
              color: userNotesOpen ? theme.palette.primary.main : theme.palette.text.secondary,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.14)' : '#fff' },
              transition: 'all 0.15s',
            }}
          >
            <EditNoteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Button
          onClick={mergeResult ? () => setShowMergedModal(true) : handleMerge}
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

      <Canvas turns={turns} onNodeClick={handleNodeClick} onAsk={handleCanvasAsk} defaultModel={defaultModel} defaultVideoEnabled={defaultVideoEnabled} defaultNotesEnabled={notesEnabled} />

      {/* My Notes slide-over — overlays the canvas from the right */}
      <Box sx={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: userNotesOpen ? 440 : 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 5,
        borderLeft: userNotesOpen ? `1px solid ${theme.palette.divider}` : 'none',
        boxShadow: userNotesOpen
          ? (isDark ? '-8px 0 32px rgba(0,0,0,0.5)' : '-8px 0 32px rgba(0,0,0,0.1)')
          : 'none',
      }}>
        <Box sx={{ width: 440, height: '100%' }}>
          <UserNotesPanel conversationId={conversationId} isOpen={userNotesOpen} />
        </Box>
      </Box>

      {selectedNode && (
        <NodeModal
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onAsk={handleAsk}
          conversationId={conversationId}
        />
      )}

      <MergeLoadingModal open={merging} sessionCount={readyCount} />

      {mergeResult && (
        <MergedVideoModal
          open={showMergedModal}
          onClose={() => setShowMergedModal(false)}
          mergedVideoUrl={mergedVideoUrl}
          sessions={mergeResult.sessions}
        />
      )}
    </Box>
  )
}
