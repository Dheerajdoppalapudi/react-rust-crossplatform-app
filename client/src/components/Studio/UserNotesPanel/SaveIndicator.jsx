import { Box, CircularProgress, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

/**
 * Displays the auto-save state in the notes panel footer.
 *
 * saveStatus: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'
 * lastSavedAt: ISO string or null
 */
export default function SaveIndicator({ saveStatus, lastSavedAt }) {
  if (saveStatus === 'idle') {
    if (!lastSavedAt) return null
    return (
      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        {formatRelative(lastSavedAt)}
      </Typography>
    )
  }

  if (saveStatus === 'unsaved') {
    return (
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
        Unsaved changes
      </Typography>
    )
  }

  if (saveStatus === 'saving') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <CircularProgress size={9} thickness={5} sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Saving…</Typography>
      </Box>
    )
  }

  if (saveStatus === 'saved') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
        <CheckIcon sx={{ fontSize: 12, color: 'success.main' }} />
        <Typography sx={{ fontSize: 11, color: 'success.main' }}>Saved</Typography>
      </Box>
    )
  }

  if (saveStatus === 'error') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
        <ErrorOutlineIcon sx={{ fontSize: 12, color: 'error.main' }} />
        <Typography sx={{ fontSize: 11, color: 'error.main' }}>Could not save</Typography>
      </Box>
    )
  }

  return null
}

function formatRelative(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 10)  return 'Edited just now'
  if (diff < 60)  return `Edited ${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60)     return `Edited ${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)     return `Edited ${h}h ago`
  return `Edited ${Math.floor(h / 24)}d ago`
}
