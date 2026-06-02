import { useState, useRef, memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, TextField, IconButton, Tooltip, Divider,
         Menu, MenuItem, CircularProgress } from '@mui/material'
import SendIcon               from '@mui/icons-material/Send'
import StopRoundedIcon        from '@mui/icons-material/StopRounded'
import AddIcon                from '@mui/icons-material/Add'
import CloseIcon              from '@mui/icons-material/Close'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import KeyboardArrowDownIcon  from '@mui/icons-material/KeyboardArrowDown'
import ParalyteLogo            from '../common/ParalyteLogo'
import FunctionsOutlinedIcon  from '@mui/icons-material/FunctionsOutlined'
import BrushOutlinedIcon      from '@mui/icons-material/BrushOutlined'
import AttachFileIcon         from '@mui/icons-material/AttachFile'
import NotesOutlinedIcon      from '@mui/icons-material/NotesOutlined'
import VideocamOutlinedIcon   from '@mui/icons-material/VideocamOutlined'
import VideocamOffOutlined    from '@mui/icons-material/VideocamOffOutlined'
import { useTheme } from '@mui/material'
import { MODELS, RENDER_MODES, MODES } from './constants'
import { BRAND, PALETTE, RADIUS } from '../../theme/tokens.js'
import { brandColor, brandHover, neutralGhost, neutralSubtle, neutralSurface, neutralActive, neutralToggle, neutralBorderFaint, neutralBorderDefault, neutralBorderStrong, neutralBorderHover, cardShadow, menuShadow } from '../../theme/styleUtils.js'
import { api } from '../../services/api.js'
import { useToast } from '../../contexts/ToastContext'

const autoModel    = MODELS.find((m) => m.id === 'auto')
const claudeModels = MODELS.filter((m) => m.provider === 'claude')
const openaiModels = MODELS.filter((m) => m.provider === 'openai')

const RENDER_MODE_ICONS = {
  auto:  <ParalyteLogo sx={{ fontSize: 13 }} />,
  manim: <FunctionsOutlinedIcon  sx={{ fontSize: 13 }} />,
  svg:   <BrushOutlinedIcon      sx={{ fontSize: 13 }} />,
}

// ── Shared menu paper style ───────────────────────────────────────────────────
// Single source of truth for all four dropdown menus in this component.
const menuPaperSx = (isDark, minWidth) => ({
  minWidth,
  borderRadius: `${RADIUS.xl}px`,
  border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
  boxShadow: menuShadow(isDark),
  mb: 0.5,
})

// ── Menu state helper ─────────────────────────────────────────────────────────

function useMenuState() {
  const [anchor, setAnchor] = useState(null)
  return {
    anchor,
    open:   (e) => setAnchor(e.currentTarget),
    close:  ()  => setAnchor(null),
    isOpen: Boolean(anchor),
  }
}

// ── Staged file chip ──────────────────────────────────────────────────────────

const FileChip = memo(function FileChip({ file, onRemove, isDark }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.4, borderRadius: `${RADIUS.full}px`,
      backgroundColor: neutralSubtle(isDark),
      border: `1px solid ${neutralBorderFaint(isDark)}`,
      maxWidth: 180,
    }}>
      <AttachFileIcon sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }} />
      <Typography sx={{
        fontSize: 11, fontWeight: 500,
        color: 'text.secondary',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {file.name}
      </Typography>
      <IconButton size="small" onClick={() => onRemove(file.id)} sx={{
        p: 0.1, color: 'text.disabled', opacity: 0.7,
        '&:hover': { opacity: 1 }, flexShrink: 0,
      }}>
        <CloseIcon sx={{ fontSize: 10 }} />
      </IconButton>
    </Box>
  )
})

// ── Pill button (shared style for mode and render selectors) ──────────────────

const Pill = memo(function Pill({ onClick, children, active = false, activeColor = null, activeBg = null, isDark, sx = {} }) {
  const theme = useTheme()
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.125, py: 0.5, borderRadius: '8px', cursor: 'pointer',
        background: 'none', fontFamily: 'inherit',
        backgroundColor: active && activeBg ? activeBg : neutralGhost(isDark),
        color: active && activeColor ? activeColor : theme.palette.text.secondary,
        border: active && activeColor
          ? `1px solid ${activeColor}55`
          : `1px solid ${neutralBorderDefault(isDark)}`,
        '&:hover': {
          borderColor: neutralBorderHover(isDark),
          bgcolor: neutralSubtle(isDark),
          color: theme.palette.text.primary,
        },
        transition: 'all 0.15s',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
})

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
  selectedTextContext,
  onClearSelectedText,
  selectedModel,
  onModelChange,
  selectedRenderMode,
  onRenderModeChange,
  selectedMode    = null,
  onModeChange    = () => {},
  stagedFiles     = [],
  onAddFiles      = () => {},
  onRemoveFile    = () => {},
  notesEnabled    = false,
  onToggleNotes   = () => {},
  videoEnabled    = true,
  onToggleVideo   = () => {},
  // When true: no outer horizontal padding (used inside EmptyView for width alignment)
  embedded        = false,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const toast  = useToast()

  const plusMenu   = useMenuState()
  const modeMenu   = useMenuState()
  const modelMenu  = useMenuState()
  const renderMenu = useMenuState()

  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef(null)

  const isFollowUp     = !!activeConversation && !isGenerating
  const isCustomRender = selectedRenderMode?.id !== 'auto'
  const canSend        = prompt.trim() && !isGenerating
  const activeMode     = selectedMode ?? MODES[0]

  const promptBorder = isDark ? PALETTE.borderDark : PALETTE.border
  const cardBg       = isDark ? PALETTE.darkSurface : PALETTE.ivory

  // Stable handlers so Pill + menu items don't re-render on every keystroke
  const handleModeMenuOpen   = useCallback((e) => modeMenu.open(e),   [modeMenu])
  const handleRenderMenuOpen = useCallback((e) => renderMenu.open(e), [renderMenu])
  const handlePlusMenuOpen   = useCallback((e) => plusMenu.open(e),   [plusMenu])

  const MAX_FILE_MB   = 25
  const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length) {
      toast.error(`File${oversized.length > 1 ? 's' : ''} too large — max ${MAX_FILE_MB} MB per file.`)
      return
    }

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
      toast.error(err?.message ?? 'File upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Outer wrapper — when embedded (inside EmptyView), skip horizontal padding
  // so the card edge aligns with the suggestion grid below it.
  const outerSx = embedded
    ? { pt: 0, pb: 0 }
    : {
        px: { xs: 1.5, sm: 3 },
        pt: 1,
        pb: { xs: 'max(env(safe-area-inset-bottom, 0px) + 12px, 16px)', sm: 2 },
      }

  const innerSx = embedded
    ? { width: '100%' }
    : { width: '100%', maxWidth: 760, mx: 'auto' }

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

      <Box sx={outerSx}>
        <Box sx={innerSx}>
          <Box sx={{
            border: `1.5px solid ${promptBorder}`,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: cardBg,
            boxShadow: cardShadow(isDark),
            '&:focus-within': {
              borderColor: brandColor(isDark),
              boxShadow: isDark ? '0 2px 20px rgba(14,124,102,0.18)' : '0 2px 20px rgba(14,124,102,0.10)',
            },
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}>

            {/* Pause context banner — flush inside card top */}
            {pauseContext && (
              <Box sx={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              }}>
                <Box sx={{ width: 3, flexShrink: 0, bgcolor: theme.palette.text.secondary }} />
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.9, minWidth: 0 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2, mb: 0.2 }}>
                      Paused at
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                      {pauseContext.caption || `Frame ${pauseContext.frameIndex + 1}`}
                    </Typography>
                  </Box>
                  <Tooltip title="Clear">
                    <IconButton size="small" onClick={onClearPauseContext} aria-label="Clear pause context"
                      sx={{ p: 0.4, color: theme.palette.text.disabled, flexShrink: 0, '&:hover': { color: theme.palette.text.secondary } }}>
                      <CloseIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}

            {/* Selected text context banner — flush inside card top */}
            {selectedTextContext && (
              <Box sx={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: `1px solid ${isDark ? 'rgba(139,92,246,0.20)' : 'rgba(124,58,237,0.15)'}`,
                backgroundColor: isDark ? 'rgba(139,92,246,0.07)' : 'rgba(124,58,237,0.04)',
              }}>
                <Box sx={{ width: 3, flexShrink: 0, bgcolor: isDark ? '#a78bfa' : '#7c3aed' }} />
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.9, minWidth: 0 }}>
                  <FormatQuoteRoundedIcon sx={{ fontSize: 15, color: isDark ? '#a78bfa' : '#7c3aed', flexShrink: 0, opacity: 0.85 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: isDark ? '#a78bfa' : '#7c3aed', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2, mb: 0.2 }}>
                      Selected text
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                      {selectedTextContext}
                    </Typography>
                  </Box>
                  <Tooltip title="Clear">
                    <IconButton size="small" onClick={onClearSelectedText} aria-label="Clear selected text context"
                      sx={{ p: 0.4, color: theme.palette.text.disabled, flexShrink: 0, '&:hover': { color: theme.palette.text.secondary } }}>
                      <CloseIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}

            {/* Text input — taller padding when embedded for more presence */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, pt: embedded ? 2 : 1.5, pb: 0.5 }}>
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
                minRows={embedded ? 2 : 1}
                maxRows={6}
                variant="standard"
                fullWidth
                slotProps={{ input: { disableUnderline: true } }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize:   embedded ? 15 : 14,
                    color:      theme.palette.text.primary,
                    py:         0,
                    lineHeight: 1.6,
                    '&::placeholder': { color: theme.palette.text.secondary, opacity: 0.5 },
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
              px: 2, pb: 1.75, pt: 1,
            }}>
              {/* LEFT: + | mode | render */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                {/* + button — rounded square */}
                <Box
                  component="button"
                  type="button"
                  onClick={handlePlusMenuOpen}
                  sx={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    width:           32,
                    height:          32,
                    borderRadius:    '8px',
                    border:          `1px solid ${neutralBorderDefault(isDark)}`,
                    backgroundColor: neutralGhost(isDark),
                    cursor:          'pointer',
                    background:      'none',
                    fontFamily:      'inherit',
                    flexShrink:      0,
                    transition:      'all 0.15s',
                    color:           theme.palette.text.secondary,
                    '&:hover': {
                      borderColor:     neutralBorderHover(isDark),
                      backgroundColor: neutralSubtle(isDark),
                      color:           theme.palette.text.primary,
                    },
                  }}
                >
                  {uploading
                    ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
                    : <AddIcon sx={{ fontSize: 16 }} />
                  }
                </Box>

                <Menu
                  anchorEl={plusMenu.anchor}
                  open={plusMenu.isOpen}
                  onClose={plusMenu.close}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  slotProps={{ paper: { sx: menuPaperSx(isDark, 200) } }}
                >
                  <MenuItem
                    onClick={() => { plusMenu.close(); fileInputRef.current?.click() }}
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
                      onClick={() => { plusMenu.close(); onNewConversation() }}
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
                <Pill onClick={handleModeMenuOpen} isDark={isDark}>
                  <Typography sx={{
                    fontSize: 14, fontWeight: 500, lineHeight: 1,
                    color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.62)',
                  }}>
                    {activeMode.label}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 14, opacity: 0.5, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
                </Pill>

                <Menu
                  anchorEl={modeMenu.anchor}
                  open={modeMenu.isOpen}
                  onClose={modeMenu.close}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  slotProps={{ paper: { sx: menuPaperSx(isDark, 220) } }}
                >
                  {MODES.map(m => (
                    <MenuItem
                      key={m.id}
                      selected={activeMode.id === m.id}
                      onClick={() => { onModeChange?.(m); modeMenu.close() }}
                      sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1.4 }}>{m.desc}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>

                {/* Render mode selector */}
                <Pill
                  onClick={handleRenderMenuOpen}
                  isDark={isDark}
                  active={isCustomRender}
                  activeColor={selectedRenderMode?.color}
                  activeBg={isDark ? `${selectedRenderMode?.color}22` : selectedRenderMode?.bg}
                  sx={{ border: isCustomRender ? `1px solid ${selectedRenderMode?.color}44` : '1px solid transparent' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isCustomRender ? selectedRenderMode?.color : 'inherit' }}>
                    {RENDER_MODE_ICONS[selectedRenderMode?.id]}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1 }}>
                    {selectedRenderMode?.id === 'auto' ? 'Auto' : selectedRenderMode?.label}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                </Pill>

                <Menu
                  anchorEl={renderMenu.anchor}
                  open={renderMenu.isOpen}
                  onClose={renderMenu.close}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  slotProps={{ paper: { sx: menuPaperSx(isDark, 210) } }}
                >
                  {RENDER_MODES.map(mode => (
                    <MenuItem
                      key={mode.id}
                      selected={selectedRenderMode?.id === mode.id}
                      onClick={() => { onRenderModeChange(mode); renderMenu.close() }}
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
                {/* Notes toggle */}
                <Tooltip title={notesEnabled ? 'AI Notes on' : 'AI Notes off'}>
                  <IconButton
                    size="small"
                    onClick={onToggleNotes}
                    aria-pressed={notesEnabled}
                    aria-label={notesEnabled ? 'AI Notes on' : 'AI Notes off'}
                    sx={{
                      borderRadius: '8px', p: 0.6,
                      border: `1px solid ${notesEnabled ? neutralBorderStrong(isDark) : neutralBorderDefault(isDark)}`,
                      color:  notesEnabled ? theme.palette.text.primary : theme.palette.text.secondary,
                      bgcolor: notesEnabled ? neutralToggle(isDark) : neutralGhost(isDark),
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: neutralBorderHover(isDark), bgcolor: neutralSubtle(isDark) },
                    }}
                  >
                    <NotesOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>

                {/* Video toggle */}
                <Tooltip title={videoEnabled ? 'Video on' : 'Video off'}>
                  <IconButton
                    size="small"
                    onClick={onToggleVideo}
                    aria-pressed={videoEnabled}
                    aria-label={videoEnabled ? 'Video on' : 'Video off'}
                    sx={{
                      borderRadius: '8px', p: 0.6,
                      border: `1px solid ${videoEnabled ? neutralBorderStrong(isDark) : neutralBorderDefault(isDark)}`,
                      color:  videoEnabled ? theme.palette.text.primary : theme.palette.text.secondary,
                      bgcolor: videoEnabled ? neutralToggle(isDark) : neutralGhost(isDark),
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: neutralBorderHover(isDark), bgcolor: neutralSubtle(isDark) },
                    }}
                  >
                    {videoEnabled
                      ? <VideocamOutlinedIcon sx={{ fontSize: 14 }} />
                      : <VideocamOffOutlined  sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
              </Box>

              {/* RIGHT: model | send/stop */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                {/* Model selector — plain text + chevron, no border (Perplexity style) */}
                <Box
                  component="button"
                  type="button"
                  onClick={modelMenu.open}
                  sx={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        0.35,
                    px:         0.75,
                    py:         0.5,
                    border:     'none',
                    background: 'none',
                    cursor:     'pointer',
                    fontFamily: 'inherit',
                    borderRadius: '6px',
                    transition: 'opacity 0.15s',
                    opacity: 0.65,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Typography sx={{
                    fontSize:      14,
                    fontWeight:    500,
                    lineHeight:    1,
                    color:         theme.palette.text.primary,
                    letterSpacing: 0.1,
                  }}>
                    {selectedModel?.short || 'Model'}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 15, color: theme.palette.text.primary }} />
                </Box>

                <Menu
                  anchorEl={modelMenu.anchor}
                  open={modelMenu.isOpen}
                  onClose={modelMenu.close}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: menuPaperSx(isDark, 230) } }}
                >
                  <MenuItem
                    key={autoModel.id}
                    selected={selectedModel?.id === autoModel.id}
                    onClick={() => { onModelChange(autoModel); modelMenu.close() }}
                    sx={{ px: 2, py: 0.75, mx: 0.5, borderRadius: '8px' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ParalyteLogo sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
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
                      onClick={() => { onModelChange(m); modelMenu.close() }}
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
                      onClick={() => { onModelChange(m); modelMenu.close() }}
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
                        backgroundColor: neutralSurface(isDark),
                        color: theme.palette.text.primary,
                        borderRadius: '8px',
                        border: `1.5px solid ${theme.palette.divider}`,
                        '&:hover': { backgroundColor: neutralActive(isDark), borderColor: theme.palette.text.secondary },
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
                          backgroundColor: canSend ? brandColor(isDark) : (isDark ? PALETTE.darkSubsurface : PALETTE.warmSand),
                          color: canSend ? '#fff' : theme.palette.text.secondary,
                          borderRadius: '8px',
                          '&:hover': { backgroundColor: canSend ? brandHover() : undefined },
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
  prompt:               PropTypes.string.isRequired,
  onPromptChange:       PropTypes.func.isRequired,
  onSubmit:             PropTypes.func.isRequired,
  onStop:               PropTypes.func.isRequired,
  onKeyDown:            PropTypes.func.isRequired,
  inputRef:             PropTypes.object.isRequired,
  isGenerating:         PropTypes.bool.isRequired,
  activeConversation:   PropTypes.shape({ id: PropTypes.string, intent_type: PropTypes.string }),
  onNewConversation:    PropTypes.func.isRequired,
  pauseContext:         PropTypes.shape({ sessionId: PropTypes.string, frameIndex: PropTypes.number, caption: PropTypes.string }),
  onClearPauseContext:  PropTypes.func.isRequired,
  selectedTextContext:  PropTypes.string,
  onClearSelectedText:  PropTypes.func,
  selectedModel:        modelShape.isRequired,
  onModelChange:        PropTypes.func.isRequired,
  selectedRenderMode:   renderModeShape,
  onRenderModeChange:   PropTypes.func.isRequired,
  selectedMode:         modeShape,
  onModeChange:         PropTypes.func,
  stagedFiles:          PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, type: PropTypes.string })),
  onAddFiles:           PropTypes.func,
  onRemoveFile:         PropTypes.func,
  notesEnabled:         PropTypes.bool,
  onToggleNotes:        PropTypes.func,
  videoEnabled:         PropTypes.bool,
  onToggleVideo:        PropTypes.func,
  embedded:             PropTypes.bool,
}

export default memo(PromptBar)
