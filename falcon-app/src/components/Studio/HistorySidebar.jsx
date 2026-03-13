import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material'
import SessionCard from './SessionCard'

export default function HistorySidebar({ sessions, selectedId, onSelect }) {
  const theme = useTheme()

  return (
    <Box sx={{
      width: 248,
      flexShrink: 0,
      borderRight: `1px solid ${theme.palette.divider}`,
      bgcolor: 'background.paper',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',   // prevents sidebar from expanding the page
    }}>
      {/* Fixed label */}
      <Box sx={{ px: 2, pt: 2, pb: 0.75, flexShrink: 0 }}>
        <Typography sx={{
          fontSize: 10, fontWeight: 600, color: theme.palette.text.secondary,
          textTransform: 'uppercase', letterSpacing: '0.7px', opacity: 0.7,
        }}>
          History
        </Typography>
      </Box>

      {/* Scrollable session list */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        px: 1.5,
        pb: 2,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
      }}>
        {sessions.length === 0 ? (
          <Typography sx={{
            fontSize: 12.5, color: theme.palette.text.secondary,
            pt: 3, textAlign: 'center', opacity: 0.5,
          }}>
            No sessions yet
          </Typography>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isSelected={selectedId === s.id}
              onClick={() => onSelect(s)}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
