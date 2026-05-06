import { memo } from 'react'
import { Box, Tooltip, IconButton, useTheme } from '@mui/material'
import NotesOutlinedIcon    from '@mui/icons-material/NotesOutlined'
import EditNoteIcon         from '@mui/icons-material/EditNote'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import VideocamOffOutlined  from '@mui/icons-material/VideocamOffOutlined'

const VIEWS = ['Chat', 'Learn']

/**
 * Toolbar buttons shared between the desktop overlay and the mobile header slot.
 *
 * Props:
 *   compact          — true in the mobile slot (no Tooltips, tighter border colors)
 *   viewMode         — 'chat' | 'learn'
 *   onViewModeChange — (mode: string) => void
 *   notesEnabled     — boolean
 *   onToggleNotes    — () => void
 *   videoEnabled     — boolean
 *   onToggleVideo    — () => void
 *   userNotesOpen    — boolean
 *   onToggleUserNotes — () => void
 */
function StudioToolbar({
  compact = false,
  viewMode,
  onViewModeChange,
  notesEnabled,
  onToggleNotes,
  videoEnabled,
  onToggleVideo,
  userNotesOpen,
  onToggleUserNotes,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const primary = theme.palette.primary.main

  const borderOn  = isDark ? 'rgba(79,110,255,0.45)' : '#c7d2fe'
  const borderOff = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'
  const colorOn   = primary
  const colorOff  = isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'
  const bgOn      = isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff'

  const btnSx = (active) => ({
    borderRadius: '7px', p: 0.6,
    border: `1px solid ${active ? borderOn : borderOff}`,
    color: active ? colorOn : colorOff,
    bgcolor: active ? bgOn : 'transparent',
    ...(!compact && {
      '&:hover': {
        borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
        color: active ? colorOn : (isDark ? '#fff' : '#374151'),
      },
      transition: 'all 0.15s',
    }),
  })

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')

  // Chat / Learn toggle
  const viewToggle = (
    <Box sx={{
      display: 'flex',
      border: `1px solid ${isDark ? (compact ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.1)') : '#e2e8f0'}`,
      borderRadius: '7px', p: 0.25, gap: 0.2,
    }}>
      {VIEWS.map((label) => {
        const m      = label.toLowerCase()
        const active = viewMode === m
        return (
          <Box
            key={m}
            component="button"
            type="button"
            onClick={() => onViewModeChange(m)}
            sx={{
              px: 1.25, py: 0.35, borderRadius: '5px', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, userSelect: 'none',
              bgcolor: active ? primary : 'transparent',
              color:   active ? '#fff' : theme.palette.text.secondary,
              transition: 'all 0.15s',
              border: 'none', fontFamily: 'inherit',
            }}
          >
            {label}
          </Box>
        )
      })}
    </Box>
  )

  const notesBtn = (
    <IconButton size="small" onClick={onToggleNotes} aria-pressed={notesEnabled}
      aria-label={notesEnabled ? 'AI Notes on' : 'AI Notes off'}
      sx={btnSx(notesEnabled)}
    >
      <NotesOutlinedIcon sx={{ fontSize: 15 }} />
    </IconButton>
  )

  const videoBtn = (
    <IconButton size="small" onClick={onToggleVideo} aria-pressed={videoEnabled}
      aria-label={videoEnabled ? 'Video on' : 'Video off'}
      sx={btnSx(videoEnabled)}
    >
      {videoEnabled
        ? <VideocamOutlinedIcon sx={{ fontSize: 15 }} />
        : <VideocamOffOutlined  sx={{ fontSize: 15 }} />}
    </IconButton>
  )

  const userNotesBtn = (
    <IconButton size="small" onClick={onToggleUserNotes} aria-pressed={userNotesOpen}
      aria-label="My Notes"
      sx={btnSx(userNotesOpen)}
    >
      <EditNoteIcon sx={{ fontSize: 16 }} />
    </IconButton>
  )

  if (compact) {
    // Mobile slot: no Tooltips, plain buttons
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {viewToggle}
        {notesBtn}
        {videoBtn}
        {userNotesBtn}
      </Box>
    )
  }

  // Desktop: wrap icon buttons with Tooltips
  return (
    <>
      {viewToggle}
      <Tooltip title={notesEnabled ? 'AI Notes on' : 'AI Notes off'}>{notesBtn}</Tooltip>
      <Tooltip title={videoEnabled ? 'Video on' : 'Video off'}>{videoBtn}</Tooltip>
      <Tooltip title={`My Notes (${isMac ? '⇧⌘N' : 'Ctrl+Shift+N'})`}>{userNotesBtn}</Tooltip>
    </>
  )
}

export default memo(StudioToolbar)
