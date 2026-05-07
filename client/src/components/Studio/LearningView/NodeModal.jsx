import { useState, useEffect } from 'react'
import {
  Dialog, Box, Typography, IconButton, TextField,
  Chip, CircularProgress, Tooltip, useTheme,
} from '@mui/material'
import CloseIcon                  from '@mui/icons-material/Close'
import SendIcon                   from '@mui/icons-material/Send'
import NotesOutlinedIcon          from '@mui/icons-material/NotesOutlined'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import { useMediaUrl } from '../../../hooks/useMediaUrl'
import VideoPanel from '../VideoPanel'
import { api } from '../../../services/api'
import { parseNotes, formatIntentType } from '../studioUtils'

function NotesList({ lines, loading, emptyText }) {
  if (loading && !lines.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
        <CircularProgress size={18} />
      </Box>
    )
  }
  if (lines.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {lines.map((line, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box sx={{
              width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
              bgcolor: 'primary.main', opacity: 0.5, mt: 0.9,
            }} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.65 }}>
              {line}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Typography sx={{ fontSize: 13, color: 'text.secondary', opacity: 0.45, fontStyle: 'italic' }}>
      {emptyText}
    </Typography>
  )
}

function FrameStrip({ sessionId, captions, activeFrame, onSelect, isDark, theme }) {
  const { getFrameUrl } = useMediaUrl(sessionId)
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: theme.palette.text.secondary, opacity: 0.55, mb: 1,
      }}>
        Slides · {captions.length}
      </Typography>

      <Box sx={{
        display: 'flex', gap: 1, overflowX: 'auto', pb: 1,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
      }}>
        {captions.map((_, fi) => (
          <Box
            key={fi}
            onClick={() => onSelect(fi)}
            sx={{
              flexShrink: 0, cursor: 'pointer', borderRadius: '8px',
              overflow: 'hidden', width: 88, height: 66, position: 'relative',
              border: `2px solid ${activeFrame === fi ? theme.palette.primary.main : 'transparent'}`,
              boxShadow: activeFrame === fi ? `0 0 0 1px ${theme.palette.primary.main}44` : 'none',
              transition: 'border-color 0.15s',
              bgcolor: isDark ? '#111' : '#f1f5f9',
            }}
          >
            <img
              src={getFrameUrl(fi) || undefined}
              alt={`slide ${fi + 1}`}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <Box sx={{
              position: 'absolute', bottom: 3, right: 4,
              fontSize: 8, fontWeight: 700, lineHeight: 1,
              color: activeFrame === fi ? theme.palette.primary.main : 'rgba(255,255,255,0.6)',
            }}>
              {fi + 1}
            </Box>
          </Box>
        ))}
      </Box>

      {captions[activeFrame] && (
        <Box sx={{
          mt: 1, px: 1.5, py: 1,
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '10px',
        }}>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.55 }}>
            <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary, mr: 0.5 }}>
              Slide {activeFrame + 1}:
            </Box>
            {captions[activeFrame]}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function VideoGeneratingPlaceholder({ isDark, theme }) {
  return (
    <Box sx={{
      width: '100%', aspectRatio: '16/9',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1.5,
      borderRadius: '12px',
      bgcolor: isDark ? '#0d0d0d' : '#f8fafc',
      border: `1px solid ${theme.palette.divider}`,
    }}>
      <CircularProgress size={32} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
      <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
        Video is being generated…
      </Typography>
    </Box>
  )
}

export default function NodeModal({ node, onClose, onAsk }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [framesData,  setFramesData]  = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [activeFrame, setActiveFrame] = useState(0)
  const [question,    setQuestion]    = useState('')

  useEffect(() => {
    if (!node) return
    setActiveFrame(0)
    setQuestion('')

    if (node.framesData) {
      // Use cached data even when captions is empty (e.g. text-only sessions
      // have no captions but do have notes — we must not re-fetch in that case).
      setFramesData(node.framesData)
    } else {
      setFramesData(null)
      setLoadingMeta(true)
      api.getFramesMeta(node.id)
        .then((raw) => {
          if (raw) setFramesData({
            captions:            raw.captions            || [],
            images:              raw.images              || [],
            notes:               raw.notes               || '',
            suggested_followups: raw.suggested_followups || [],
          })
        })
        .finally(() => setLoadingMeta(false))
    }
  }, [node?.id, node?.framesData])

  if (!node) return null

  const captions   = framesData?.captions || []
  const noteLines  = parseNotes(framesData?.notes)
  const hasCaption = captions.length > 0

  const hasQuestion = Boolean(question.trim())

  const handleAsk = () => {
    if (!hasQuestion) return
    onAsk({
      question:    question.trim(),
      sessionId:   node.id,
      frameIndex:  hasCaption ? activeFrame : null,
      caption:     captions[activeFrame] || null,
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  return (
    <Dialog
      open={!!node}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width:           '90vw',
          maxWidth:        1240,
          height:          '88vh',
          m:               0,
          borderRadius:    '12px',
          overflow:        'hidden',
          bgcolor:         isDark ? '#141414' : '#ffffff',
          backgroundImage: 'none',
        },
      }}
    >
      <Box sx={{
        px: 3, py: 1.75, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, mr: 2, minWidth: 0 }}>
          {node.intent_type && (
            <Typography sx={{
              fontSize: 10, fontWeight: 700, px: 0.9, py: 0.3,
              borderRadius: '5px', textTransform: 'capitalize', flexShrink: 0,
              bgcolor: isDark ? 'rgba(79,110,255,0.12)' : '#f0f4ff',
              color: theme.palette.primary.main,
              border: `1px solid ${isDark ? 'rgba(79,110,255,0.3)' : '#c7d2fe'}`,
            }}>
              {formatIntentType(node.intent_type)}
            </Typography>
          )}
          <Typography sx={{
            fontSize: 14, fontWeight: 600,
            color: theme.palette.text.primary,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          }}>
            {node.prompt}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        <Box sx={{
          flex: '0 0 60%',
          display: 'flex', flexDirection: 'column',
          p: 2.5, overflow: 'auto',
          borderRight: `1px solid ${theme.palette.divider}`,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
        }}>
          {node.render_path === 'interactive' ? (
            // Non-video node: show the prompt + notes content
            <Box sx={{ flex: 1, overflow: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
            }}>
              <Box sx={{
                mb: 2, px: 2, py: 1.5, borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                border: `1px solid ${theme.palette.divider}`,
              }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.secondary, opacity: 0.55, mb: 0.75 }}>
                  Prompt
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, lineHeight: 1.6 }}>
                  {node.prompt}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <NotesOutlinedIcon sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.secondary, opacity: 0.6 }}>
                  Response
                </Typography>
              </Box>
              <NotesList lines={noteLines} loading={loadingMeta} emptyText="No content for this session." />
            </Box>
          ) : node.videoPhase === 'generating' ? (
            <VideoGeneratingPlaceholder isDark={isDark} theme={theme} />
          ) : (
            <VideoPanel sessionId={node.id} videoPhase={node.videoPhase} onPauseAsk={null} />
          )}

          {node.render_path !== 'interactive' && (
            <>
              {loadingMeta && !captions.length && (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                  <CircularProgress size={20} />
                </Box>
              )}
              {captions.length > 0 && (
                <FrameStrip
                  sessionId={node.id}
                  captions={captions}
                  activeFrame={activeFrame}
                  onSelect={setActiveFrame}
                  isDark={isDark}
                  theme={theme}
                />
              )}
            </>
          )}
        </Box>

        <Box sx={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          <Box sx={{
            flex: 1, overflowY: 'auto', p: 2.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.75 }}>
              <NotesOutlinedIcon sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
              <Typography sx={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.palette.text.secondary, opacity: 0.6,
              }}>
                Lesson Notes
              </Typography>
            </Box>

            <NotesList lines={noteLines} loading={loadingMeta} emptyText="No lesson notes for this session." />
          </Box>

          <Box sx={{
            flexShrink: 0, p: 2.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fafafa',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
              <QuestionAnswerOutlinedIcon sx={{ fontSize: 13, color: theme.palette.primary.main }} />
              <Typography sx={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: theme.palette.primary.main, opacity: 0.85,
              }}>
                Ask a follow-up
              </Typography>
            </Box>

            {hasCaption && (
              <Chip
                label={`Context: Slide ${activeFrame + 1}`}
                size="small"
                sx={{
                  mb: 1.25, fontSize: 10.5, height: 24, cursor: 'default',
                  bgcolor: isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff',
                  color: theme.palette.primary.main,
                  border: `1px solid ${isDark ? 'rgba(79,110,255,0.25)' : '#c7d2fe'}`,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask something about this lesson…"
                multiline
                maxRows={4}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 13,
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  },
                }}
              />
              <Tooltip title="Ask (Enter)">
                <span>
                  <IconButton
                    onClick={handleAsk}
                    disabled={!hasQuestion}
                    size="small"
                    sx={{
                      width: 38, height: 38, flexShrink: 0,
                      bgcolor: hasQuestion ? theme.palette.primary.main : 'transparent',
                      color: hasQuestion ? '#fff' : theme.palette.text.disabled,
                      border: `1.5px solid ${hasQuestion ? theme.palette.primary.main : theme.palette.divider}`,
                      borderRadius: '10px',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: theme.palette.primary.dark, color: '#fff' },
                      '&:disabled': { opacity: 0.4 },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
