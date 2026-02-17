import { Box, Typography } from '@mui/material'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'

const FileAttachment = ({ file }) => {
  const isImage = file.type?.startsWith('image/')

  if (isImage) {
    return (
      <Box
        component="img"
        src={file.url}
        alt={file.name}
        sx={{
          maxWidth: 240,
          maxHeight: 180,
          borderRadius: '6px',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        px: 1.5,
        py: 1,
        maxWidth: 220,
      }}
    >
      <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: '#888' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#999' }}>
          {file.size}
        </Typography>
      </Box>
    </Box>
  )
}

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user'
  const hasFiles = message.files && message.files.length > 0

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          maxWidth: isUser ? '75%' : '85%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {/* Attachments */}
        {hasFiles && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            {message.files.map((file, i) => (
              <FileAttachment key={i} file={file} />
            ))}
          </Box>
        )}

        {/* Text */}
        {message.content && (
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderRadius: '6px',
              backgroundColor: isUser ? '#f0f0f0' : '#f7f7f8',
              color: isUser ? '#1a1a1a' : '#2b2b2b',
            }}
          >
            <Typography
              sx={{
                fontSize: 15,
                whiteSpace: 'pre-wrap',
                lineHeight: isUser ? 1.6 : 1.8,
              }}
            >
              {message.content}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default ChatMessage
