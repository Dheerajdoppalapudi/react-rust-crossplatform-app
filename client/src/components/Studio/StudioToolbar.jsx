import { memo } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import EditNoteIcon           from '@mui/icons-material/EditNote'
import MenuBookOutlinedIcon   from '@mui/icons-material/MenuBookOutlined'

const VIEWS = ['Chat', 'Learn']

const VIEW_ICON = {
  learn: <MenuBookOutlinedIcon sx={{ fontSize: 13, flexShrink: 0 }} />,
}

function StudioToolbar({
  compact = false,
  viewMode,
  onViewModeChange,
  userNotesOpen,
  onToggleUserNotes,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')

  // ── Chat / Learn pill — floats independently, no outer wrapper ───────────
  const viewToggle = (
    <Box sx={{
      display:     'inline-flex',
      alignItems:  'center',
      bgcolor:     isDark ? 'rgba(20,20,20,0.94)' : 'rgba(255,255,255,0.94)',
      border:      `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      borderRadius:'10px',
      p:           0.5,
      gap:         0.25,
      boxShadow:   isDark
        ? '0 2px 12px rgba(0,0,0,0.5)'
        : '0 2px 12px rgba(0,0,0,0.10)',
      backdropFilter: 'blur(12px)',
    }}>
      {VIEWS.map((label) => {
        const m      = label.toLowerCase()
        const active = viewMode === m
        const icon   = VIEW_ICON[m]
        return (
          <Box
            key={m}
            component="button"
            type="button"
            onClick={() => onViewModeChange(m)}
            sx={{
              display:    'flex', alignItems: 'center', gap: 0.6,
              px:         1.625, py: 0.625,
              borderRadius: '8px',
              cursor: 'pointer', userSelect: 'none',
              border: 'none', fontFamily: 'inherit',
              bgcolor: active
                ? (isDark ? '#2FD4B5' : '#0E7C66')
                : 'transparent',
              color: active
                ? (isDark ? '#0d1f1b' : '#fff')
                : (isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)'),
              transition: 'background 0.18s, color 0.18s',
              '&:hover': !active ? {
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color:   isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.72)',
              } : {},
            }}
          >
            {icon && (
              <Box sx={{ color: 'inherit', display: 'flex', alignItems: 'center' }}>
                {icon}
              </Box>
            )}
            <Typography sx={{
              fontSize: 13, fontWeight: 600, lineHeight: 1,
              color: 'inherit', fontFamily: 'inherit',
            }}>
              {label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )

  // ── Notes button — standalone, same visual weight as the pill ────────────
  const notesBg     = userNotesOpen
    ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
    : (isDark ? 'rgba(20,20,20,0.94)' : 'rgba(255,255,255,0.94)')
  const notesBorder = `1px solid ${userNotesOpen
    ? (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)')
    : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)')}`

  const userNotesBtn = (
    <IconButton
      size="small"
      onClick={onToggleUserNotes}
      aria-pressed={userNotesOpen}
      aria-label="My Notes"
      sx={{
        borderRadius: '8px', p: 0.875,
        bgcolor:      notesBg,
        border:       notesBorder,
        color:        userNotesOpen
          ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)')
          : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
        boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.10)',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.15s',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
          color:   isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.72)',
        },
      }}
    >
      <EditNoteIcon sx={{ fontSize: 17 }} />
    </IconButton>
  )

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {viewToggle}
        {userNotesBtn}
      </Box>
    )
  }

  return (
    <>
      {viewToggle}
      <Tooltip title={`My Notes (${isMac ? '⇧⌘N' : 'Ctrl+Shift+N'})`}>
        {userNotesBtn}
      </Tooltip>
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
