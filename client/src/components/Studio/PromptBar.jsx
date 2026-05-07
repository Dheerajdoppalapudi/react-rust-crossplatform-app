import { useState, useRef, memo } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, TextField, IconButton, Tooltip, Divider,
         Menu, MenuItem, CircularProgress } from '@mui/material'
import SendIcon               from '@mui/icons-material/Send'
import StopRoundedIcon        from '@mui/icons-material/StopRounded'
import AddIcon                from '@mui/icons-material/Add'
import CloseIcon              from '@mui/icons-material/Close'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import KeyboardArrowDownIcon  from '@mui/icons-material/KeyboardArrowDown'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import FunctionsOutlinedIcon  from '@mui/icons-material/FunctionsOutlined'
import BrushOutlinedIcon      from '@mui/icons-material/BrushOutlined'
import AttachFileIcon         from '@mui/icons-material/AttachFile'
import { useTheme } from '@mui/material'
import { MODELS, RENDER_MODES, MODES } from './constants'
import { BRAND, PALETTE } from '../../theme/tokens.js'
import { api } from '../../services/api.js'

const autoModel    = MODELS.find((m) => m.id === 'auto')
const claudeModels = MODELS.filter((m) => m.provider === 'claude')
const openaiModels = MODELS.filter((m) => m.provider === 'openai')

const RENDER_MODE_ICONS = {
  auto:  <AutoAwesomeOutlinedIcon sx={{ fontSize: 13 }} />,
  manim: <FunctionsOutlinedIcon  sx={{ fontSize: 13 }} />,
  svg:   <BrushOutlinedIcon      sx={{ fontSize: 13 }} />,
}

// ── Staged file chip ──────────────────────────────────────────────────────────

function FileChip({ file, onRemove, isDark }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.4, borderRadius: '20px',
      backgroundColor: isDark ? 'rgba(75,114,255,0.12)' : 'rgba(24,71,214,0.07)',
      border: `1px solid ${isDark ? 'rgba(75,114,255,0.25)' : 'rgba(24,71,214,0.2)'}`,
      maxWidth: 180,
    }}>
      <AttachFileIcon sx={{ fontSize: 11, color: isDark ? '#7b9fff' : BRAND.primary, flexShrink: 0 }} />
      <Typography sx={{
        fontSize: 11, fontWeight: 500,
        color: isDark ? '#7b9fff' : BRAND.primary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {file.name}
      </Typography>
      <IconButton size="small" onClick={() => onRemove(file.id)} sx={{
        p: 0.1, color: isDark ? '#7b9fff' : BRAND.primary, opacity: 0.7,
        '&:hover': { opacity: 1 }, flexShrink: 0,
      }}>
        <CloseIcon sx={{ fontSize: 10 }} />
      </IconButton>
    </Box>
  )
}

// ── Pill button (shared style) ────────────────────────────────────────────────

function PillButton({ onClick, children, active = false, activeColor = null, activeBg = null, isDark, sx = {} }) {
  const theme = useTheme()
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.4,
        px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
        background: 'none', fontFamily: 'inherit',
        backgroundColor: active && activeBg ? activeBg : 'transparent',
        color: active && activeColor ? activeColor : theme.palette.text.secondary,
        border: active && activeColor ? `1px solid ${activeColor}44` : '1px solid transparent',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          color: theme.palette.text.primary,
        },
        transition: 'all 0.15s',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function PromptBar({
  prompt,
  onPromptChange,
  onSubmit,
  onStop,
  onKeyDown,
  inputRef,
  isGenerating,
  activeConversation,
  onNewConversation,
  pauseContext,
  onClearPauseContext,
  selectedModel,
  onModelChange,
  selectedRenderMode,
  onRenderModeChange,
  // Generation mode
  selectedMode,
  onModeChange,
  // Staged file attachments
  stagedFiles,
  onAddFiles,
  onRemoveFile,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [plusMenuAnchor,   setPlusMenuAnchor]   = useState(null)
  const [modeMenuAnchor,   setModeMenuAnchor]   = useState(null)
  const [modelMenuAnchor,  setModelMenuAnchor]  = useState(null)
  const [renderMenuAnchor, setRenderMenuAnchor] = useState(null)
  const [uploading,        setUploading]        = useState(false)

  const fileInputRef = useRef(null)

  const isFollowUp     = !!activeConversation && !isGenerating
  const isCustomRender = selectedRenderMode?.id !== 'auto'
  const canSend        = prompt.trim() && !isGenerating
  const activeMode     = selectedMode ?? MODES[0]

  const promptBorder = isDark ? PALETTE.dividerDark : PALETTE.borderCream
  const cardBg       = isDark ? PALETTE.darkSurface : PALETTE.ivory

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const result = await api.uploadFiles(files)
      const staged = (result?.files ?? []).map(f => ({
        id:   f.saved_as,
        name: f.original_name,
        type: f.content_type ?? 'application/octet-stream',
      }))
      if (staged.length) onAddFiles?.(staged)
    } catch (err) {
      console.error('[PromptBar] upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box sx={{ flexShrink: 0 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.pptx,.txt,.md"
        multiple
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />

      {/* Pause context banner */}
      {pauseContext && (
        <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 1.5, pb: 0 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 0.75, borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(75,114,255,0.10)' : `${BRAND.primary}0d`,
            border: `1px solid ${isDark ? 'rgba(75,114,255,0.25)' : `${BRAND.primary}30`}`,
          }}>
            <PauseCircleOutlineIcon sx={{ fontSize: 14, color: theme.palette.primary.main, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: theme.palette.primary.main, fontWeight: 500, flexShrink: 0 }}>
              Paused at:
            </Typography>
            <Typography sx={{
              fontSize: 12, color: theme.palette.primary.main,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {pauseContext.caption || `Frame ${pauseContext.frameIndex + 1}`}
            </Typography>
            <Tooltip title="Clear pause context">
              <IconButton
                size="small"
                onClick={onClearPauseContext}
                aria-label="Clear pause context"
                sx={{ p: 0.25, color: theme.palette.primary.main, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1 } }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 1, pb: { xs: 'max(env(safe-area-inset-bottom, 0px) + 12px, 16px)', sm: 2 } }}>
        <Box sx={{ maxWidth: 760, mx: 'auto' }}>
          <Box sx={{
            border: `1.5px solid ${promptBorder}`,
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: cardBg,
            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)',
            '&:focus-within': {
              borderColor: theme.palette.primary.main,
              boxShadow: isDark ? '0 2px 20px rgba(75,114,255,0.15)' : '0 2px 20px rgba(24,71,214,0.08)',
            },
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}>

            {/* Text input */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, pt: 1.25, pb: 0.25 }}>
              <TextField
                inputRef={inputRef}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  isGenerating ? 'Generating…' :
                  pauseContext  ? 'Ask your question about this moment…' :
                  isFollowUp    ? 'Ask a follow-up…' :
                                  'What do you want to learn today?'
                }
                multiline
                minRows={1}
                maxRows={6}
                variant="standard"
                fullWidth
                slotProps={{ input: { disableUnderline: true } }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: 14, color: theme.palette.text.primary, py: 0,
                    '&::placeholder': { color: theme.palette.text.secondary, opacity: 0.55 },
                  },
                }}
              />
            </Box>

            {/* Staged file chips */}
            {stagedFiles?.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 2, pb: 0.75 }}>
                {stagedFiles.map(f => (
                  <FileChip key={f.id} file={f} onRemove={onRemoveFile} isDark={isDark} />
                ))}
              </Box>
            )}

            {/* Bottom control row */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, pb: 1.25, pt: 0.25,
            }}>
              {/* LEFT: + | mode | render */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>

                {/* + button */}
                <PillButton
                  onClick={(e) => setPlusMenuAnchor(e.currentTarget)}
                  isDark={isDark}
                  sx={{ px: 0.75 }}
                >
                  {uploading
                    ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                    : <AddIcon sx={{ fontSize: 14 }} />
                  }
                  <KeyboardArrowDownIcon sx={{ fontSize: 11, opacity: 0.6 }} />
                </PillButton>

                <Menu
                  anchorEl={plusMenuAnchor}
                  open={Boolean(plusMenuAnchor)}
                  onClose={() => setPlusMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  slotProps={{ paper: { sx: { minWidth: 200, borderRadius: '12px', border: `1px solid ${theme.palette.divider}`, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)', mb: 0.5 } } }}
                >
                  <MenuItem
                    onClick={() => { setPlusMenuAnchor(null); fileInputRef.current?.click() }}
                    sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachFileIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>Upload files</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>PDF, PPTX, TXT, MD</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  {isFollowUp && [
                    <Divider key="div" sx={{ my: 0.5, mx: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />,
                    <MenuItem
                      key="new-conv"
                      onClick={() => { setPlusMenuAnchor(null); onNewConversation() }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AddIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>New conversation</Typography>
                      </Box>
                    </MenuItem>,
                  ]}
                </Menu>

                {/* Mode selector */}
                <PillButton
                  onClick={(e) => setModeMenuAnchor(e.currentTarget)}
                  isDark={isDark}
                >
                  <Typography sx={{ fontSize: 11, mr: 0.2 }}>{activeMode.icon}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>{activeMode.label}</Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </PillButton>

                <Menu
                  anchorEl={modeMenuAnchor}
                  open={Boolean(modeMenuAnchor)}
                  onClose={() => setModeMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  slotProps={{ paper: { sx: { minWidth: 220, borderRadius: '12px', border: `1px solid ${theme.palette.divider}`, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)', mb: 0.5 } } }}
                >
                  {MODES.map(m => (
                    <MenuItem
                      key={m.id}
                      selected={activeMode.id === m.id}
                      onClick={() => { onModeChange?.(m); setModeMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 14, lineHeight: 1 }}>{m.icon}</Typography>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                          <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.desc}</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>

                {/* Render mode selector */}
                <PillButton
                  onClick={(e) => setRenderMenuAnchor(e.currentTarget)}
                  isDark={isDark}
                  active={isCustomRender}
                  activeColor={selectedRenderMode?.color}
                  activeBg={isDark ? `${selectedRenderMode?.color}22` : selectedRenderMode?.bg}
                  sx={{ border: isCustomRender ? `1px solid ${selectedRenderMode?.color}44` : '1px solid transparent' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isCustomRender ? selectedRenderMode?.color : 'inherit' }}>
                    {RENDER_MODE_ICONS[selectedRenderMode?.id]}
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
                    {selectedRenderMode?.id === 'auto' ? 'Auto' : selectedRenderMode?.label}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </PillButton>

                <Menu
                  anchorEl={renderMenuAnchor}
                  open={Boolean(renderMenuAnchor)}
                  onClose={() => setRenderMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  slotProps={{ paper: { sx: { minWidth: 210, borderRadius: '12px', border: `1px solid ${theme.palette.divider}`, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)', mb: 0.5 } } }}
                >
                  {RENDER_MODES.map(mode => (
                    <MenuItem
                      key={mode.id}
                      selected={selectedRenderMode?.id === mode.id}
                      onClick={() => { onRenderModeChange(mode); setRenderMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{ color: mode.color || theme.palette.text.disabled, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {RENDER_MODE_ICONS[mode.id]}
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{mode.label}</Typography>
                          <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{mode.description}</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </Box>

              {/* RIGHT: model | send/stop */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>

                {/* Model selector */}
                <PillButton
                  onClick={(e) => setModelMenuAnchor(e.currentTarget)}
                  isDark={isDark}
                >
                  {selectedModel?.id === 'auto' && (
                    <AutoAwesomeOutlinedIcon sx={{ fontSize: 12, opacity: 0.6 }} />
                  )}
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
                    {selectedModel?.short || 'Auto'}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </PillButton>

                <Menu
                  anchorEl={modelMenuAnchor}
                  open={Boolean(modelMenuAnchor)}
                  onClose={() => setModelMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { minWidth: 230, borderRadius: '12px', border: `1px solid ${theme.palette.divider}`, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)', mb: 0.5 } } }}
                >
                  <MenuItem
                    key={autoModel.id}
                    selected={selectedModel?.id === autoModel.id}
                    onClick={() => { onModelChange(autoModel); setModelMenuAnchor(null) }}
                    sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AutoAwesomeOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{autoModel.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{autoModel.description}</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <Divider sx={{ my: 0.5, mx: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
                  {claudeModels.map(m => (
                    <MenuItem
                      key={m.id}
                      selected={selectedModel?.id === m.id}
                      onClick={() => { onModelChange(m); setModelMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.description}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider sx={{ my: 0.5, mx: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
                  {openaiModels.map(m => (
                    <MenuItem
                      key={m.id}
                      selected={selectedModel?.id === m.id}
                      onClick={() => { onModelChange(m); setModelMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.description}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>

                {/* Send / Stop */}
                {isGenerating ? (
                  <Tooltip title="Stop generating">
                    <IconButton
                      onClick={onStop}
                      size="small"
                      aria-label="Stop generation"
                      sx={{
                        width: 32, height: 32,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: theme.palette.text.primary,
                        borderRadius: '8px',
                        border: `1.5px solid ${theme.palette.divider}`,
                        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.11)', borderColor: theme.palette.text.secondary },
                        transition: 'all 0.15s',
                      }}
                    >
                      <StopRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title={!prompt.trim() ? 'Type something to generate' : 'Generate (Enter)'}>
                    <span>
                      <IconButton
                        onClick={onSubmit}
                        disabled={!canSend}
                        size="small"
                        aria-label="Send message"
                        sx={{
                          width: 32, height: 32,
                          backgroundColor: canSend ? theme.palette.primary.main : (isDark ? PALETTE.darkSubsurface : PALETTE.warmSand),
                          color: canSend ? '#fff' : theme.palette.text.secondary,
                          borderRadius: '8px',
                          '&:hover': { backgroundColor: canSend ? BRAND.primary : undefined },
                          transition: 'all 0.15s',
                        }}
                      >
                        <SendIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

const modelShape = PropTypes.shape({
  id:          PropTypes.string.isRequired,
  provider:    PropTypes.string,
  model:       PropTypes.string,
  label:       PropTypes.string.isRequired,
  short:       PropTypes.string,
  description: PropTypes.string,
})

const renderModeShape = PropTypes.shape({
  id:          PropTypes.string.isRequired,
  label:       PropTypes.string.isRequired,
  description: PropTypes.string,
  color:       PropTypes.string,
  bg:          PropTypes.string,
})

const modeShape = PropTypes.shape({
  id:    PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon:  PropTypes.string,
  desc:  PropTypes.string,
})

PromptBar.propTypes = {
  prompt:              PropTypes.string.isRequired,
  onPromptChange:      PropTypes.func.isRequired,
  onSubmit:            PropTypes.func.isRequired,
  onStop:              PropTypes.func.isRequired,
  onKeyDown:           PropTypes.func.isRequired,
  inputRef:            PropTypes.object.isRequired,
  isGenerating:        PropTypes.bool.isRequired,
  activeConversation:  PropTypes.shape({ id: PropTypes.string, intent_type: PropTypes.string }),
  onNewConversation:   PropTypes.func.isRequired,
  pauseContext:        PropTypes.shape({ sessionId: PropTypes.string, frameIndex: PropTypes.number, caption: PropTypes.string }),
  onClearPauseContext: PropTypes.func.isRequired,
  selectedModel:       modelShape.isRequired,
  onModelChange:       PropTypes.func.isRequired,
  selectedRenderMode:  renderModeShape,
  onRenderModeChange:  PropTypes.func.isRequired,
  selectedMode:        modeShape,
  onModeChange:        PropTypes.func,
  stagedFiles:         PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, type: PropTypes.string })),
  onAddFiles:          PropTypes.func,
  onRemoveFile:        PropTypes.func,
}

PromptBar.defaultProps = {
  selectedMode: null,
  onModeChange: () => {},
  stagedFiles:  [],
  onAddFiles:   () => {},
  onRemoveFile: () => {},
}

export default memo(PromptBar)
