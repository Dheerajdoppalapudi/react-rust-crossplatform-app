import { Box, Typography, TextField, IconButton, Tooltip, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import { useTheme } from '@mui/material'
import { FOLLOWUP_SUGGESTIONS } from './constants'

export default function PromptBar({
  prompt,
  onPromptChange,
  onSubmit,
  onKeyDown,
  inputRef,
  isGenerating,
  followUpCtx,
  onClearFollowUp,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const canSend    = prompt.trim() && !isGenerating
  const isFollowUp = !!followUpCtx && !isGenerating

  const suggestions = isFollowUp
    ? (FOLLOWUP_SUGGESTIONS[followUpCtx.intent_type] || FOLLOWUP_SUGGESTIONS.illustration)
    : []

  const promptBg     = isDark ? '#1f1f1f' : '#fafafa'
  const promptBorder = isDark ? '#2e2e2e' : '#e2e8f0'

  return (
    <Box sx={{
      flexShrink: 0,
      borderTop: `1px solid ${theme.palette.divider}`,
      bgcolor: 'background.paper',
    }}>
      {/* Follow-up suggestions */}
      {isFollowUp && suggestions.length > 0 && (
        <Box sx={{ px: 3, pt: 1.5, pb: 0 }}>
          <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.55, mb: 0.75 }}>
            Suggested follow-ups
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {suggestions.map((s) => (
              <Box
                key={s}
                onClick={() => { onPromptChange(s); inputRef.current?.focus() }}
                sx={{
                  px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer',
                  border: `1px solid ${theme.palette.divider}`,
                  fontSize: 12, color: theme.palette.text.secondary, userSelect: 'none',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                    backgroundColor: isDark ? 'rgba(79,110,255,0.08)' : '#f5f7ff',
                  },
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ px: 3, pt: 1.5, pb: 2 }}>
        {/* Follow-up context indicator */}
        {isFollowUp && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <SubdirectoryArrowRightIcon sx={{ fontSize: 13, color: theme.palette.text.secondary, opacity: 0.45 }} />
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, opacity: 0.55, flexShrink: 0 }}>
              Following up on:
            </Typography>
            <Typography sx={{
              fontSize: 11.5, color: theme.palette.primary.main, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              "{followUpCtx.prompt}"
            </Typography>
            <Tooltip title="Start new question">
              <IconButton
                size="small"
                onClick={onClearFollowUp}
                sx={{ p: 0.3, color: theme.palette.text.secondary, opacity: 0.5, '&:hover': { opacity: 1 }, flexShrink: 0 }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Text field row */}
        <Box sx={{
          display: 'flex', alignItems: 'flex-end', gap: 1,
          border: `1.5px solid ${promptBorder}`,
          borderRadius: '12px', px: 2, py: 1,
          backgroundColor: promptBg,
          '&:focus-within': {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.background.paper,
          },
          transition: 'all 0.15s',
        }}>
          <TextField
            inputRef={inputRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isFollowUp ? 'Ask a follow-up question…' : 'What do you want to visualize today?'}
            multiline
            maxRows={4}
            disabled={isGenerating}
            variant="standard"
            fullWidth
            slotProps={{ input: { disableUnderline: true } }}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: 14, color: theme.palette.text.primary, py: 0.25,
                '&::placeholder': { color: theme.palette.text.secondary, opacity: 0.6 },
              },
            }}
          />
          <Tooltip title="Generate (Enter)">
            <span>
              <IconButton
                onClick={onSubmit}
                disabled={!canSend}
                size="small"
                sx={{
                  width: 34, height: 34, flexShrink: 0, mb: 0.25,
                  backgroundColor: canSend ? theme.palette.primary.main : (isDark ? '#2a2a2a' : '#f1f5f9'),
                  color: canSend ? '#fff' : theme.palette.text.secondary,
                  '&:hover': { backgroundColor: canSend ? (isDark ? '#3D58FF' : '#0015cc') : undefined },
                  transition: 'all 0.15s',
                }}
              >
                {isGenerating
                  ? <CircularProgress size={14} sx={{ color: theme.palette.text.secondary }} />
                  : <SendIcon sx={{ fontSize: 14 }} />
                }
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, opacity: 0.4, mt: 0.75, ml: 0.5 }}>
          Enter to generate · Shift+Enter for new line
        </Typography>
      </Box>
    </Box>
  )
}
