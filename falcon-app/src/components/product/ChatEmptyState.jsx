import { Box, Typography } from '@mui/material'

const ChatEmptyState = () => {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: 22,
          fontWeight: 600,
          color: '#1a1a1a',
        }}
      >
        What can I help with?
      </Typography>
    </Box>
  )
}

export default ChatEmptyState
