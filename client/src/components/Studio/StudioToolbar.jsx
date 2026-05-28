import { memo } from 'react'
import PropTypes from 'prop-types'
import { Box, Tooltip, IconButton, useTheme } from '@mui/material'
import EditNoteIcon from '@mui/icons-material/EditNote'

const VIEWS = ['Chat', 'Learn']

/**
 * Toolbar buttons shared between the desktop overlay and the mobile header slot.
 *
 * Props:
 *   compact          — true in the mobile slot (no Tooltips, tighter border colors)
 *   viewMode         — 'chat' | 'learn'
 *   onViewModeChange — (mode: string) => void
 *   userNotesOpen    — boolean
 *   onToggleUserNotes — () => void
 */
function StudioToolbar({
  compact = false,
  viewMode,
  onViewModeChange,
  userNotesOpen,
  onToggleUserNotes,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const borderOn  = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
  const borderOff = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'
  const colorOn   = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)'
  const colorOff  = isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'
  const bgOn      = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'

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
              bgcolor: active ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') : 'transparent',
              color:   active ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)') : theme.palette.text.secondary,
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

  const userNotesBtn = (
    <IconButton size="small" onClick={onToggleUserNotes} aria-pressed={userNotesOpen}
      aria-label="My Notes"
      sx={btnSx(userNotesOpen)}
    >
      <EditNoteIcon sx={{ fontSize: 16 }} />
    </IconButton>
  )

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {viewToggle}
        {userNotesBtn}
      </Box>
    )
  }

  return (
    <>
      {viewToggle}
      <Tooltip title={`My Notes (${isMac ? '⇧⌘N' : 'Ctrl+Shift+N'})`}>{userNotesBtn}</Tooltip>
    </>
  )
}

StudioToolbar.propTypes = {
  compact:           PropTypes.bool,
  viewMode:          PropTypes.oneOf(['chat', 'learn']).isRequired,
  onViewModeChange:  PropTypes.func.isRequired,
  userNotesOpen:     PropTypes.bool.isRequired,
  onToggleUserNotes: PropTypes.func.isRequired,
}

export default memo(StudioToolbar)
