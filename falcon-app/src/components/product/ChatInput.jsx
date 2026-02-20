import { useState, useRef } from 'react'
import { Box, TextField, IconButton, Chip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import CloseIcon from '@mui/icons-material/Close'

const MODES = [
  { key: 'image_generation', label: 'Image Generation' },
]

const ChatInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState([])
  const [mode, setMode] = useState(null) // null = default chat
  const fileInputRef = useRef(null)

  const handleSend = () => {
    const text = value.trim()
    if (!text && files.length === 0) return
    onSend(text, files, mode)
    setValue('')
    setFiles([])
  }

  const toggleMode = (key) => {
    setMode((prev) => (prev === key ? null : key))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    setFiles((prev) => [...prev, ...selected])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const canSend = !disabled && (value.trim() || files.length > 0)

  return (
    <Box sx={{ px: 2, pb: 2.5, pt: 1.5, backgroundColor: '#fff' }}>
      <Box sx={{ maxWidth: 680, mx: 'auto' }}>
        <Box
          sx={{
            backgroundColor: '#f4f4f4',
            borderRadius: '16px',
            transition: 'box-shadow 0.2s',
            '&:focus-within': {
              boxShadow: '0 0 0 2px rgba(0,26,255,0.15)',
            },
          }}
        >
          {/* Attachment preview */}
          {files.length > 0 && (
            <Box sx={{ px: 2.5, pt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {files.map((file, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 0.75,
                    maxWidth: 220,
                  }}
                >
                  {file.type.startsWith('image/') ? (
                    <Box
                      component="img"
                      src={URL.createObjectURL(file)}
                      sx={{ width: 32, height: 32, borderRadius: '4px', objectFit: 'cover' }}
                    />
                  ) : (
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: '#888' }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                      {formatSize(file.size)}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => removeFile(i)} sx={{ p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 14, color: '#999' }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {/* Mode chips */}
          <Box sx={{ px: 2, pt: 1.5, pb: 0, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {MODES.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                size="small"
                clickable
                onClick={() => toggleMode(key)}
                sx={{
                  fontSize: 12,
                  height: 26,
                  borderRadius: '6px',
                  backgroundColor: mode === key ? '#1a1a1a' : 'transparent',
                  color: mode === key ? '#fff' : '#666',
                  border: mode === key ? '1px solid #1a1a1a' : '1px solid #d0d0d0',
                  '&:hover': {
                    backgroundColor: mode === key ? '#333' : 'rgba(0,0,0,0.04)',
                  },
                }}
              />
            ))}
          </Box>

          {/* Input row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 1.5, py: 1 }}>
            <IconButton
              size="small"
              onClick={() => fileInputRef.current?.click()}
              sx={{
                mb: 0.25,
                color: '#888',
                width: 36,
                height: 36,
                '&:hover': { color: '#555', backgroundColor: 'rgba(0,0,0,0.04)' },
              }}
            >
              <AttachFileIcon sx={{ fontSize: 20, transform: 'rotate(45deg)' }} />
            </IconButton>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              hidden
            />
            <TextField
              fullWidth
              multiline
              maxRows={6}
              placeholder="Message Falcon..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              variant="standard"
              InputProps={{
                disableUnderline: true,
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: 15,
                  py: 1,
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={!canSend}
              size="small"
              sx={{
                mb: 0.25,
                backgroundColor: canSend ? '#1a1a1a' : 'transparent',
                color: canSend ? '#fff' : '#bbb',
                borderRadius: '50%',
                width: 36,
                height: 36,
                flexShrink: 0,
                border: canSend ? 'none' : '1.5px solid #d9d9d9',
                transition: 'all 0.2s',
                '&:hover': { backgroundColor: '#333' },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: '#bbb',
                  border: '1.5px solid #d9d9d9',
                },
              }}
            >
              <ArrowUpwardIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'center', mt: 1.5 }}>
          <Box component="span" sx={{ fontSize: 12, color: '#b0b0b0' }}>
            Falcon echoes your messages
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default ChatInput
