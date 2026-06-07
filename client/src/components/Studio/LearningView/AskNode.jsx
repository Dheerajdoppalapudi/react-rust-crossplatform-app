import { useState, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography, IconButton, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PromptBar from '../PromptBar'
import { DEFAULT_MODEL, DEFAULT_RENDER_MODE, DEFAULT_MODE } from '../constants'

const ASK_NODE_W = 460

export default function AskNode({ data }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'

  const [prompt,        setPrompt]        = useState('')
  const [selectedModel, setSelectedModel] = useState(data.defaultModel ?? DEFAULT_MODEL)
  const [renderMode,    setRenderMode]    = useState(DEFAULT_RENDER_MODE)
  const [selectedMode,  setSelectedMode]  = useState(DEFAULT_MODE)
  const [videoEnabled,  setVideoEnabled]  = useState(data.defaultVideoEnabled ?? true)
  const [notesEnabled,  setNotesEnabled]  = useState(data.defaultNotesEnabled ?? true)
  const [stagedFiles,   setStagedFiles]   = useState([])

  const inputRef    = useRef(null)
  const nodeRef     = useRef(null)
  const onCancelRef = useRef(data.onCancel)
  useEffect(() => { onCancelRef.current = data.onCancel }, [data.onCancel])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && nodeRef.current?.contains(document.activeElement)) {
        e.stopPropagation()
        onCancelRef.current?.()
      }
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [])

  const handleSubmit = () => {
    if (!prompt.trim()) return
    data.onSubmit?.({ question: prompt.trim(), model: selectedModel, videoEnabled, notesEnabled })
  }

  const handleKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <Box ref={nodeRef} sx={{ width: ASK_NODE_W }}>
        {/* Small label row above the card */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          mb: 0.75, px: 0.5,
        }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)',
          }}>
            Ask a follow-up
          </Typography>
          <IconButton aria-label="Cancel"
            size="small"
            onClick={() => data.onCancel?.()}
            sx={{
              width: 20, height: 20, borderRadius: '5px',
              color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                color:   isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              },
              transition: 'all 0.15s',
            }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>

        <PromptBar
          embedded
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={handleSubmit}
          onStop={() => {}}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          isGenerating={false}
          activeConversation={null}
          onNewConversation={() => {}}
          pauseContext={null}
          onClearPauseContext={() => {}}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          selectedRenderMode={renderMode}
          onRenderModeChange={setRenderMode}
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          stagedFiles={stagedFiles}
          onAddFiles={(files) => setStagedFiles((prev) => [...prev, ...files])}
          onRemoveFile={(id)  => setStagedFiles((prev) => prev.filter((f) => f.id !== id))}
          notesEnabled={notesEnabled}
          onToggleNotes={() => setNotesEnabled((n) => !n)}
          videoEnabled={videoEnabled}
          onToggleVideo={() => setVideoEnabled((v) => !v)}
        />
      </Box>
    </>
  )
}
