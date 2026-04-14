import { useState } from 'react'
import { Box, Typography, TextField, IconButton, Tooltip, CircularProgress, Divider,
         Menu, MenuItem, ListSubheader } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useTheme } from '@mui/material'
import { MODELS, RENDER_MODES } from './constants'

export default function PromptBar({
  prompt,
  onPromptChange,
  onSubmit,
  onKeyDown,
  inputRef,
  isGenerating,
  activeConversation,   // { id, intent_type } | null
  onNewConversation,
  pauseContext,         // { sessionId, frameIndex, caption } | null
  onClearPauseContext,
  selectedModel,        // { id, provider, model, label, short, description }
  onModelChange,
  selectedRenderMode,   // { id, label, description, color, bg } | null
  onRenderModeChange,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [menuAnchor,       setMenuAnchor]       = useState(null)
  const [renderMenuAnchor, setRenderMenuAnchor] = useState(null)
  const menuOpen       = Boolean(menuAnchor)
  const renderMenuOpen = Boolean(renderMenuAnchor)

  const isFollowUp = !!activeConversation && !isGenerating
  const canSend    = prompt.trim() && !isGenerating

  const promptBorder = isDark ? '#333333' : '#dde3ec'
  const cardBg       = isDark ? '#1a1a1a' : '#ffffff'

  // Group models by provider for the dropdown
  const claudeModels = MODELS.filter((m) => m.provider === 'claude')
  const openaiModels = MODELS.filter((m) => m.provider === 'openai')

  return (
    <Box sx={{ flexShrink: 0 }}>

      {/* Pause context indicator */}
      {pauseContext && (
        <Box sx={{ px: 3, pt: 1.5, pb: 0 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 0.75, borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff',
            border: `1px solid ${isDark ? 'rgba(79,110,255,0.25)' : '#c7d2fe'}`,
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
                sx={{ p: 0.25, color: theme.palette.primary.main, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1 } }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ px: 3, pt: 1, pb: 2 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto' }}>
          {/* Card */}
          <Box sx={{
            border: `1.5px solid ${promptBorder}`,
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: cardBg,
            boxShadow: isDark
              ? '0 2px 12px rgba(0,0,0,0.35)'
              : '0 2px 12px rgba(0,0,0,0.06)',
            '&:focus-within': {
              borderColor: theme.palette.primary.main,
              boxShadow: isDark
                ? '0 2px 20px rgba(79,110,255,0.15)'
                : '0 2px 20px rgba(0,26,255,0.08)',
            },
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}>
            {/* Text row */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, pt: 1.25, pb: 0.25 }}>
              {isFollowUp && (
                <Tooltip title="Start a new conversation">
                  <IconButton
                    size="small"
                    onClick={onNewConversation}
                    sx={{
                      mt: 0.25, width: 26, height: 26, flexShrink: 0,
                      color: theme.palette.text.secondary,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '7px',
                      '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              )}
              <TextField
                inputRef={inputRef}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  isGenerating ? 'Generating your visual…' :
                  pauseContext  ? 'Ask your question about this moment…' :
                  isFollowUp    ? 'Ask a follow-up…' :
                                  'What do you want to visualize today?'
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

            {/* Toolbar row */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, pb: 1.25, pt: 0.25,
            }}>
              {/* Model selector */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                    color: theme.palette.text.secondary,
                    userSelect: 'none',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: theme.palette.text.primary,
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
                    {selectedModel?.short || 'Model'}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </Box>

                <Menu
                  anchorEl={menuAnchor}
                  open={menuOpen}
                  onClose={() => setMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  slotProps={{
                    paper: {
                      sx: {
                        minWidth: 230,
                        borderRadius: '12px',
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: isDark
                          ? '0 8px 32px rgba(0,0,0,0.6)'
                          : '0 8px 32px rgba(0,0,0,0.12)',
                        mb: 0.5,
                      },
                    },
                  }}
                >
                  <ListSubheader sx={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    color: theme.palette.text.secondary, lineHeight: '30px',
                    textTransform: 'uppercase', bgcolor: 'background.paper',
                    px: 2,
                  }}>
                    Claude
                  </ListSubheader>
                  {claudeModels.map((m) => (
                    <MenuItem
                      key={m.id}
                      selected={selectedModel?.id === m.id}
                      onClick={() => { onModelChange(m); setMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.description}</Typography>
                      </Box>
                    </MenuItem>
                  ))}

                  <Divider sx={{ my: 0.5 }} />

                  <ListSubheader sx={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    color: theme.palette.text.secondary, lineHeight: '30px',
                    textTransform: 'uppercase', bgcolor: 'background.paper',
                    px: 2,
                  }}>
                    OpenAI
                  </ListSubheader>
                  {openaiModels.map((m) => (
                    <MenuItem
                      key={m.id}
                      selected={selectedModel?.id === m.id}
                      onClick={() => { onModelChange(m); setMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.description}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </Box>

              {/* Render mode selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', mr: 1 }}>
                <Box
                  onClick={(e) => setRenderMenuAnchor(e.currentTarget)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: selectedRenderMode?.id !== 'auto'
                      ? (isDark
                          ? `${selectedRenderMode?.color}22`
                          : `${selectedRenderMode?.bg}`)
                      : 'transparent',
                    color: selectedRenderMode?.id !== 'auto'
                      ? selectedRenderMode?.color
                      : theme.palette.text.secondary,
                    border: selectedRenderMode?.id !== 'auto'
                      ? `1px solid ${selectedRenderMode?.color}44`
                      : '1px solid transparent',
                    '&:hover': {
                      bgcolor: selectedRenderMode?.id !== 'auto'
                        ? (isDark ? `${selectedRenderMode?.color}33` : `${selectedRenderMode?.bg}`)
                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      color: selectedRenderMode?.id !== 'auto'
                        ? selectedRenderMode?.color
                        : theme.palette.text.primary,
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  {selectedRenderMode?.id !== 'auto' && (
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      bgcolor: selectedRenderMode?.color, flexShrink: 0,
                    }} />
                  )}
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
                    {selectedRenderMode?.id === 'auto' ? 'Auto' : selectedRenderMode?.label}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </Box>

                <Menu
                  anchorEl={renderMenuAnchor}
                  open={renderMenuOpen}
                  onClose={() => setRenderMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  slotProps={{
                    paper: {
                      sx: {
                        minWidth: 210,
                        borderRadius: '12px',
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: isDark
                          ? '0 8px 32px rgba(0,0,0,0.6)'
                          : '0 8px 32px rgba(0,0,0,0.12)',
                        mb: 0.5,
                      },
                    },
                  }}
                >
                  <ListSubheader sx={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    color: theme.palette.text.secondary, lineHeight: '30px',
                    textTransform: 'uppercase', bgcolor: 'background.paper',
                    px: 2,
                  }}>
                    Render Mode
                  </ListSubheader>
                  {RENDER_MODES.map((mode) => (
                    <MenuItem
                      key={mode.id}
                      selected={selectedRenderMode?.id === mode.id}
                      onClick={() => { onRenderModeChange(mode); setRenderMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        {mode.color ? (
                          <Box sx={{
                            width: 8, height: 8, borderRadius: '50%',
                            bgcolor: mode.color, flexShrink: 0,
                          }} />
                        ) : (
                          <Box sx={{ width: 8, height: 8, flexShrink: 0 }} />
                        )}
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
                            {mode.label}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>
                            {mode.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </Box>

              {/* Send button — tooltip explains disabled state */}
              <Tooltip title={isGenerating ? 'Generating…' : !prompt.trim() ? 'Type something to generate' : 'Generate (Enter)'}>
                <span>
                  <IconButton
                    onClick={onSubmit}
                    disabled={!canSend}
                    size="small"
                    sx={{
                      width: 32, height: 32,
                      backgroundColor: canSend ? theme.palette.primary.main : (isDark ? '#2a2a2a' : '#f1f5f9'),
                      color: canSend ? '#fff' : theme.palette.text.secondary,
                      borderRadius: '8px',
                      '&:hover': { backgroundColor: canSend ? (isDark ? '#3D58FF' : '#0015cc') : undefined },
                      transition: 'all 0.15s',
                    }}
                  >
                    {isGenerating
                      ? <CircularProgress size={13} sx={{ color: theme.palette.text.secondary }} />
                      : <SendIcon sx={{ fontSize: 14 }} />
                    }
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
