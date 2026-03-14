import { Box, Typography, TextField, IconButton, Tooltip, CircularProgress, Chip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import { useTheme } from '@mui/material'
import { FOLLOWUP_SUGGESTIONS } from './constants'

export default function PromptBar({
  prompt,
  onPromptChange,
  onSubmit,
  onKeyDown,
  inputRef,
  isGenerating,
  activeConversation,   // { id, intent_type } | null
  onNewConversation,
  pauseContext,         // { sessionId, frameIndex, caption } | null
  onClearPauseContext,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const isFollowUp = !!activeConversation && !isGenerating
  const canSend    = prompt.trim() && !isGenerating

  // Use LLM-generated follow-ups when available; fall back to generic constants
  const suggestions = isFollowUp && !pauseContext
    ? (activeConversation.suggested_followups?.length
        ? activeConversation.suggested_followups
        : (FOLLOWUP_SUGGESTIONS[activeConversation.intent_type] || FOLLOWUP_SUGGESTIONS.illustration))
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

      {/* Pause context indicator */}
      {pauseContext && (
        <Box sx={{ px: 3, pt: 1.5, pb: 0 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 0.75, borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff',
            border: `1px solid ${isDark ? 'rgba(79,110,255,0.25)' : '#c7d2fe'}`,
          }}>
            <PauseCircleOutlineIcon sx={{ fontSize: 14, color: theme.palette.primary.main, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: theme.palette.primary.main, fontWeight: 500, flexShrink: 0 }}>
              Paused at:
            </Typography>
            <Typography sx={{
              fontSize: 12, color: theme.palette.primary.main,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {pauseContext.caption || `Frame ${pauseContext.frameIndex + 1}`}
            </Typography>
            <Tooltip title="Clear pause context">
              <IconButton
                size="small"
                onClick={onClearPauseContext}
                sx={{ p: 0.25, color: theme.palette.primary.main, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1 } }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ px: 3, pt: 1.5, pb: 2 }}>
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
          {/* New conversation button (only while in a conversation) */}
          {isFollowUp && (
            <Tooltip title="Start a new conversation">
              <IconButton
                size="small"
                onClick={onNewConversation}
                sx={{
                  width: 28, height: 28, flexShrink: 0, mb: 0.25,
                  color: theme.palette.text.secondary,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '8px',
                  '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main },
                }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}

          <TextField
            inputRef={inputRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              pauseContext   ? 'Ask your question about this moment…' :
              isFollowUp     ? 'Ask a follow-up…' :
                               'What do you want to visualize today?'
            }
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
