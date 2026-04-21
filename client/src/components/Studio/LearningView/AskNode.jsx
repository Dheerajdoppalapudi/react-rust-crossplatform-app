import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography, TextField, IconButton, Tooltip, useTheme } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

const ASK_NODE_W = 272

export default function AskNode({ data }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const primary = theme.palette.primary.main
  const [question, setQuestion] = useState('')

  const handleSubmit = () => {
    if (!question.trim()) return
    data.onSubmit?.(question.trim())
  }

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <Box sx={{
        width: ASK_NODE_W,
        borderRadius: '12px',
        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
        bgcolor: isDark ? '#1e1e2a' : '#ffffff',
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
        {/* Accent strip */}
        <Box sx={{ height: 2, background: `linear-gradient(90deg, transparent, ${primary}77, transparent)` }} />

        <Box sx={{ p: 1.75 }}>
          <TextField
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
              if (e.key === 'Escape') data.onCancel?.()
            }}
            placeholder="Ask a follow-up…"
            multiline
            rows={3}
            size="small"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: 13, borderRadius: '8px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: isDark ? '#f1f5f9' : '#1e293b',
                '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                '&:hover fieldset': { borderColor: `${primary}55` },
                '&.Mui-focused fieldset': { borderColor: `${primary}99` },
              },
              '& .MuiInputBase-input::placeholder': {
                color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)',
                opacity: 1,
              },
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.25 }}>
            <Typography sx={{ fontSize: 9.5, color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.26)' }}>
              Enter to generate · Esc to cancel
            </Typography>
            <Tooltip title="Generate (Enter)">
              <span>
                <IconButton
                  onClick={handleSubmit}
                  disabled={!question.trim()}
                  size="small"
                  sx={{
                    width: 30, height: 30,
                    bgcolor: question.trim() ? primary : 'transparent',
                    color: question.trim() ? '#fff' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                    border: `1.5px solid ${question.trim() ? primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                    borderRadius: '8px',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: theme.palette.primary.dark, color: '#fff', borderColor: theme.palette.primary.dark },
                    '&.Mui-disabled': { opacity: 0.3 },
                  }}
                >
                  <SendIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </>
  )
}
