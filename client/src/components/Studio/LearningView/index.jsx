import { useState, useRef, useCallback } from 'react'
import { Box, IconButton, Typography, Tooltip, useTheme, Button, CircularProgress } from '@mui/material'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import MergeIcon      from '@mui/icons-material/MergeType'
import EditNoteIcon   from '@mui/icons-material/EditNote'
import Canvas         from './Canvas'
import NodeModal      from './NodeModal'
import MergedVideoModal   from './MergedVideoModal'
import MergeLoadingModal  from './MergeLoadingModal'
import UserNotesPanel from '../UserNotesPanel/index'
import PromptBar      from '../PromptBar'
import { DEFAULT_MODEL, DEFAULT_RENDER_MODE, DEFAULT_MODE } from '../constants'
import { api } from '../../../services/api'
import { getConversationMediaToken } from '../../../services/mediaToken'
import { API_BASE } from '../../../constants/api.js'
import { neutralBorderStrong, neutralHover } from '../../../theme/styleUtils.js'
import { useIsDark } from '../../../hooks/useIsDark.js'

export default function LearningView({ turns, conversationId, onExit, onAskFromLearn, onGenerateFromCanvas, defaultModel, defaultVideoEnabled, notesEnabled, userNotesOpen, onToggleUserNotes }) {
  const theme  = useTheme()
  const isDark = useIsDark()

  const [selectedNode,    setSelectedNode]    = useState(null)
  const [nodePanelWidth,  setNodePanelWidth]  = useState(() => Math.round(window.innerWidth * 0.45))
  const [isResizing,      setIsResizing]      = useState(false)
  const nodePanelRef      = useRef(null)
  const resizeStartXRef   = useRef(0)
  const resizeStartWRef   = useRef(0)
  const [merging,         setMerging]         = useState(false)
  const [mergeResult,     setMergeResult]     = useState(null)
  const [showMergedModal, setShowMergedModal] = useState(false)
  const [mergeError,      setMergeError]      = useState(null)
  const [mergedVideoUrl,  setMergedVideoUrl]  = useState(null)

  // Empty-state PromptBar state
  const [canvasPrompt,     setCanvasPrompt]     = useState('')
  const [canvasModel,      setCanvasModel]      = useState(defaultModel ?? DEFAULT_MODEL)
  const [canvasRenderMode, setCanvasRenderMode] = useState(DEFAULT_RENDER_MODE)
  const [canvasMode,       setCanvasMode]       = useState(DEFAULT_MODE)
  const [canvasVideo,      setCanvasVideo]      = useState(defaultVideoEnabled ?? true)
  const [canvasNotes,      setCanvasNotes]      = useState(notesEnabled ?? true)
  const [canvasFiles,      setCanvasFiles]      = useState([])
  const canvasInputRef = useRef(null)

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

  const handleEmptySubmit = () => {
    const q = canvasPrompt.trim()
    if (!q) return
    setCanvasPrompt('')
    handleCanvasAsk({ question: q, model: canvasModel, videoEnabled: canvasVideo, notesEnabled: canvasNotes })
  }

  const handleCanvasKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEmptySubmit()
    }
  }

  const handleNodeResizeStart = useCallback((e) => {
    e.preventDefault()
    resizeStartXRef.current = e.clientX
    resizeStartWRef.current = nodePanelRef.current?.offsetWidth ?? nodePanelWidth
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e) => {
      const vw = window.innerWidth
      const delta = resizeStartXRef.current - e.clientX
      const newW = Math.min(
        Math.round(vw * 0.70),
        Math.max(Math.round(vw * 0.30), resizeStartWRef.current + delta)
      )
      setNodePanelWidth(newW)
    }
    const onUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [nodePanelWidth])

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
  const isEmpty    = turns.length === 0

  return (
    <Box sx={{
      position:      'fixed',
      inset:         0,
      zIndex:        1300,
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* ── Main content row: [canvas column] + node panel + my notes ─────── */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Canvas column — fills remaining width and SHRINKS when the node panel
            opens. The floating toolbars/hint live inside it (position:absolute is
            scoped to this column), so they slide with the canvas instead of
            staying pinned over the detail panel. */}
        <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', display: 'flex' }}>
          <Canvas
            turns={turns}
            onNodeClick={handleNodeClick}
            onAsk={handleCanvasAsk}
            defaultModel={defaultModel}
            defaultVideoEnabled={defaultVideoEnabled}
            defaultNotesEnabled={notesEnabled}
            selectedNodeId={selectedNode?.id ?? selectedNode?.tempId ?? null}
          />

          {/* Top-left: back + label */}
          <Box sx={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Tooltip title="Back to chat" placement="right">
              <IconButton aria-label="Back"
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
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', color: theme.palette.text.primary }}>
                Learning Canvas
              </Typography>
            </Box>
          </Box>

          {/* Top-right: My Notes + Merge Videos */}
          <Box sx={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            {mergeError && (
              <Typography sx={{ fontSize: 11, color: '#f87171', bgcolor: 'rgba(239,68,68,0.12)', px: 1.5, py: 0.5, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
                {mergeError}
              </Typography>
            )}

            <Tooltip title="My Notes" placement="bottom">
              <IconButton aria-label="Toggle notes"
                size="small"
                onClick={onToggleUserNotes}
                aria-pressed={userNotesOpen}
                sx={{
                  bgcolor: userNotesOpen
                    ? (neutralHover(isDark))
                    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)'),
                  border: `1px solid ${userNotesOpen
                    ? (neutralBorderStrong(isDark))
                    : (isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0')}`,
                  color: userNotesOpen ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)') : theme.palette.text.secondary,
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
              {merging ? 'Merging…' : mergeResult ? 'View Merged' : 'Merge Videos'}
            </Button>
          </Box>

          {/* Bottom hint pill — centered on the canvas, not the viewport */}
          {!isEmpty && (
            <Box sx={{
              position: 'absolute', bottom: 20, left: '50%',
              transform: 'translateX(-50%)', zIndex: 10,
              px: 2, py: 0.6,
              bgcolor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.8)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '20px',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
            }}>
              <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary }}>
                Click a node to explore · Drag to reposition · Scroll to zoom
              </Typography>
            </Box>
          )}
        </Box>

        {/* Node detail panel — resizable 20–65vw, default 30vw */}
        <Box
          ref={nodePanelRef}
          sx={{
            width:      selectedNode ? nodePanelWidth : 0,
            flexShrink: 0,
            overflow:   'visible',   // allow handle pill to straddle the border
            position:   'relative',
            borderLeft: selectedNode ? `1px solid ${theme.palette.divider}` : 'none',
            transition: isResizing ? 'none' : 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            bgcolor:    isDark ? '#141414' : '#ffffff',
            height:     '100%',
          }}
        >
          {/* Drag-to-resize handle — pill centered on the border line */}
          {selectedNode && (
            <Box
              onMouseDown={handleNodeResizeStart}
              sx={{
                position: 'absolute', left: -6, top: 0, bottom: 0, width: 12,
                cursor: 'col-resize', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                '&:hover .resize-thumb': {
                  bgcolor: theme.palette.primary.main,
                  opacity: 1,
                },
              }}
            >
              <Box
                className="resize-thumb"
                sx={{
                  width: 4, height: 32,
                  borderRadius: '3px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                  opacity: 0.75,
                  transition: 'background-color 0.15s, opacity 0.15s',
                  pointerEvents: 'none',
                }}
              />
            </Box>
          )}

          {/* Inner content box clips NodeModal within the panel bounds */}
          {selectedNode && (
            <Box sx={{
              position: 'absolute', inset: 0, overflow: 'hidden',
              animation: 'panelFadeIn 0.2s ease',
              '@keyframes panelFadeIn': {
                from: { opacity: 0, transform: 'translateX(8px)' },
                to:   { opacity: 1, transform: 'translateX(0)' },
              },
            }}>
              <NodeModal
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onAsk={handleAsk}
                conversationId={conversationId}
              />
            </Box>
          )}
        </Box>

        {/* My Notes panel — same as normal view (440px default), pushes canvas left */}
        <UserNotesPanel
          conversationId={conversationId}
          isOpen={userNotesOpen}
        />
      </Box>

      {/* ── Empty state overlay ───────────────────────────────────────────── */}
      {isEmpty && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 8,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <Box sx={{ pointerEvents: 'auto', width: '100%', maxWidth: 600, px: 3 }}>
            <Typography sx={{
              fontSize: 22, fontWeight: 700, mb: 0.75, textAlign: 'center',
              color: theme.palette.text.primary,
            }}>
              What do you want to learn?
            </Typography>
            <Typography sx={{
              fontSize: 13.5, mb: 2.5, textAlign: 'center',
              color: theme.palette.text.secondary,
            }}>
              Start a topic and watch it grow into an interactive knowledge tree.
            </Typography>

            <PromptBar
              embedded
              prompt={canvasPrompt}
              onPromptChange={setCanvasPrompt}
              onSubmit={handleEmptySubmit}
              onStop={() => {}}
              onKeyDown={handleCanvasKeyDown}
              inputRef={canvasInputRef}
              isGenerating={false}
              activeConversation={null}
              onNewConversation={() => {}}
              pauseContext={null}
              onClearPauseContext={() => {}}
              selectedModel={canvasModel}
              onModelChange={setCanvasModel}
              selectedRenderMode={canvasRenderMode}
              onRenderModeChange={setCanvasRenderMode}
              selectedMode={canvasMode}
              onModeChange={setCanvasMode}
              stagedFiles={canvasFiles}
              onAddFiles={(files) => setCanvasFiles((prev) => [...prev, ...files])}
              onRemoveFile={(id)  => setCanvasFiles((prev) => prev.filter((f) => f.id !== id))}
              notesEnabled={canvasNotes}
              onToggleNotes={() => setCanvasNotes((n) => !n)}
              videoEnabled={canvasVideo}
              onToggleVideo={() => setCanvasVideo((v) => !v)}
            />
          </Box>
        </Box>
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
