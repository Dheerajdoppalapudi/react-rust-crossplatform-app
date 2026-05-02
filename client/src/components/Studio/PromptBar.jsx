import { useState } from 'react'
import { Box, Typography, TextField, IconButton, Tooltip, CircularProgress, Divider,
         Menu, MenuItem } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined'
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined'
import { useTheme } from '@mui/material'
import { MODELS, RENDER_MODES } from './constants'
import { BRAND, PALETTE } from '../../theme/tokens.js'

const claudeModels = MODELS.filter((m) => m.provider === 'claude')
const openaiModels = MODELS.filter((m) => m.provider === 'openai')

const RENDER_MODE_ICONS = {
  auto:  <AutoAwesomeOutlinedIcon sx={{ fontSize: 13 }} />,
  manim: <FunctionsOutlinedIcon  sx={{ fontSize: 13 }} />,
  svg:   <BrushOutlinedIcon      sx={{ fontSize: 13 }} />,
}

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

  const isFollowUp    = !!activeConversation && !isGenerating
  const isCustomRender = selectedRenderMode?.id !== 'auto'
  const canSend    = prompt.trim() && !isGenerating

  const promptBorder = isDark ? PALETTE.dividerDark : PALETTE.borderCream
  const cardBg       = isDark ? PALETTE.darkSurface : PALETTE.ivory

  return (
    <Box sx={{ flexShrink: 0 }}>

      {pauseContext && (
        <Box sx={{ px: 3, pt: 1.5, pb: 0 }}>
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
                sx={{ p: 0.25, color: theme.palette.primary.main, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1 } }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      <Box sx={{ px: 3, pt: 1, pb: 2 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto' }}>
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
                ? '0 2px 20px rgba(75,114,255,0.15)'
                : '0 2px 20px rgba(24,71,214,0.08)',
            },
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}>
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

            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, pb: 1.25, pt: 0.25,
            }}>
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
                  open={Boolean(menuAnchor)}
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

                  <Divider sx={{ my: 0.5, mx: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />

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

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', mr: 1 }}>
                <Box
                  onClick={(e) => setRenderMenuAnchor(e.currentTarget)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isCustomRender
                      ? (isDark
                          ? `${selectedRenderMode?.color}22`
                          : `${selectedRenderMode?.bg}`)
                      : 'transparent',
                    color: isCustomRender
                      ? selectedRenderMode?.color
                      : theme.palette.text.secondary,
                    border: isCustomRender
                      ? `1px solid ${selectedRenderMode?.color}44`
                      : '1px solid transparent',
                    '&:hover': {
                      bgcolor: isCustomRender
                        ? (isDark ? `${selectedRenderMode?.color}33` : `${selectedRenderMode?.bg}`)
                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      color: isCustomRender
                        ? selectedRenderMode?.color
                        : theme.palette.text.primary,
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <Box sx={{
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    color: isCustomRender ? selectedRenderMode?.color : theme.palette.text.secondary,
                  }}>
                    {RENDER_MODE_ICONS[selectedRenderMode?.id]}
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1 }}>
                    {selectedRenderMode?.id === 'auto' ? 'Auto' : selectedRenderMode?.label}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                </Box>

                <Menu
                  anchorEl={renderMenuAnchor}
                  open={Boolean(renderMenuAnchor)}
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
                  {RENDER_MODES.map((mode) => (
                    <MenuItem
                      key={mode.id}
                      selected={selectedRenderMode?.id === mode.id}
                      onClick={() => { onRenderModeChange(mode); setRenderMenuAnchor(null) }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{
                          color: mode.color || theme.palette.text.disabled,
                          display: 'flex', alignItems: 'center', flexShrink: 0,
                        }}>
                          {RENDER_MODE_ICONS[mode.id]}
                        </Box>
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

              <Tooltip title={isGenerating ? 'Generating…' : !prompt.trim() ? 'Type something to generate' : 'Generate (Enter)'}>
                <span>
                  <IconButton
                    onClick={onSubmit}
                    disabled={!canSend}
                    size="small"
                    sx={{
                      width: 32, height: 32,
                      backgroundColor: canSend ? theme.palette.primary.main : (isDark ? PALETTE.darkSubsurface : PALETTE.warmSand),
                      color: canSend ? '#fff' : theme.palette.text.secondary,
                      borderRadius: '8px',
                      '&:hover': { backgroundColor: canSend ? BRAND.primary : undefined },
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
