import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Typography, TextField, IconButton, Tooltip, useTheme, Menu, MenuItem } from '@mui/material'
import SendIcon            from '@mui/icons-material/Send'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import VideocamOffOutlined  from '@mui/icons-material/VideocamOffOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { PALETTE } from '../../../theme/tokens.js'
import { MODELS, DEFAULT_MODEL } from '../constants'

const ASK_NODE_W = 340

export default function AskNode({ data }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const primary = theme.palette.primary.main

  const [question,      setQuestion]      = useState('')
  const [videoEnabled,  setVideoEnabled]  = useState(data.defaultVideoEnabled ?? true)
  const [selectedModel, setSelectedModel] = useState(data.defaultModel ?? DEFAULT_MODEL)
  const [menuAnchor,    setMenuAnchor]    = useState(null)

  const isValid = Boolean(question.trim())

  const handleSubmit = () => {
    if (!isValid) return
    data.onSubmit?.({ question: question.trim(), model: selectedModel, videoEnabled })
  }

  const borderCol  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'
  const subTextCol = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)'

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <Box sx={{
        width: ASK_NODE_W,
        borderRadius: '12px',
        border: `1.5px solid ${borderCol}`,
        bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
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
                color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                '&:hover fieldset': { borderColor: `${primary}55` },
                '&.Mui-focused fieldset': { borderColor: `${primary}99` },
              },
              '& .MuiInputBase-input::placeholder': {
                color: subTextCol,
                opacity: 1,
              },
            }}
          />

          {/* Model + video row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
            <Box
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer',
                px: 0.9, py: 0.4, borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                transition: 'background 0.15s',
              }}
            >
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                {selectedModel.short}
              </Typography>
              <KeyboardArrowDownIcon sx={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }} />
            </Box>

            <Tooltip title={videoEnabled ? 'Video on — click to disable' : 'Video off — click to enable'}>
              <IconButton
                size="small"
                onClick={() => setVideoEnabled((v) => !v)}
                sx={{
                  width: 26, height: 26,
                  borderRadius: '6px',
                  border: `1px solid ${videoEnabled ? `${primary}55` : borderCol}`,
                  bgcolor: videoEnabled ? `${primary}14` : 'transparent',
                  color: videoEnabled ? primary : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
                  '&:hover': { bgcolor: videoEnabled ? `${primary}22` : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') },
                  transition: 'all 0.15s',
                }}
              >
                {videoEnabled
                  ? <VideocamOutlinedIcon sx={{ fontSize: 13 }} />
                  : <VideocamOffOutlined  sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>

            <Box sx={{ flex: 1 }} />

            <Tooltip title="Generate (Enter)">
              <span>
                <IconButton
                  onClick={handleSubmit}
                  disabled={!isValid}
                  size="small"
                  sx={{
                    width: 30, height: 30,
                    bgcolor: isValid ? primary : 'transparent',
                    color: isValid ? '#fff' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                    border: `1.5px solid ${isValid ? primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
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

          <Typography sx={{ fontSize: 9, color: subTextCol, mt: 0.75 }}>
            Enter · Esc to cancel
          </Typography>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{
          sx: {
            mt: 0.5, minWidth: 180, borderRadius: '10px',
            bgcolor: isDark ? '#1e1e1e' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)',
          },
        }}
      >
        {MODELS.map((m) => (
          <MenuItem
            key={m.id}
            selected={m.id === selectedModel.id}
            onClick={() => { setSelectedModel(m); setMenuAnchor(null) }}
            sx={{
              fontSize: 12.5, py: 0.9, px: 1.5, gap: 1,
              borderRadius: '6px', mx: 0.5,
              '&.Mui-selected': { bgcolor: isDark ? 'rgba(79,110,255,0.14)' : '#f0f4ff' },
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc' },
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{m.short}</Typography>
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.1 }}>{m.description}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
