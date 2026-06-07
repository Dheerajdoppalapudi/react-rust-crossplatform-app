import { useState, useEffect } from 'react'
import {
  Box, Typography, IconButton,
  TextField, Chip, CircularProgress, Tooltip, useTheme,
} from '@mui/material'
import CloseIcon                  from '@mui/icons-material/Close'
import SendIcon                   from '@mui/icons-material/Send'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import CheckCircleOutlinedIcon    from '@mui/icons-material/CheckCircleOutlined'
import { useMediaUrl }    from '../../../hooks/useMediaUrl'
import VideoPanel         from '../VideoPanel'
import BlockRenderer      from '../../Interactive/BlockRenderer'
import { api }            from '../../../services/api'
import { formatIntentType } from '../studioUtils'
import { pulse } from '../../../theme/animations'
import { neutralBorderDefault } from '../../../theme/styleUtils.js'
import { useIsDark } from '../../../hooks/useIsDark.js'

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
              overflow: 'hidden', width: 80, height: 60, position: 'relative',
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
          <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 1.55 }}>
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

function LoadingPanel({ node, theme }) {
  const primary = theme.palette.primary.main
  const stages  = node.stages || []
  const activeStage = stages.find((s) => s.status === 'active')

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2.5,
      py: 6, px: 2,
    }}>
      <CircularProgress size={20} thickness={2.5} sx={{ color: primary, opacity: 0.55 }} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}>
          {activeStage?.label ?? 'Thinking about your question…'}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.55 }}>
          {node.prompt}
        </Typography>
      </Box>
      {stages.length > 0 && (
        <Box sx={{ width: '100%', maxWidth: 260 }}>
          {stages.map((stage, i) => {
            const isDone   = stage.status === 'done'
            const isActive = stage.status === 'active'
            return (
              <Box key={stage.id ?? i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.55 }}>
                {isDone ? (
                  <CheckCircleOutlinedIcon sx={{ fontSize: 13, color: '#22c55e', flexShrink: 0 }} />
                ) : isActive ? (
                  <Box sx={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    bgcolor: primary, animation: `${pulse} 1.2s ease-in-out infinite`,
                  }} />
                ) : (
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, bgcolor: theme.palette.divider }} />
                )}
                <Typography sx={{
                  fontSize: 12, fontWeight: isActive ? 500 : 400, flex: 1,
                  color: isDone ? theme.palette.text.secondary : isActive ? theme.palette.text.primary : theme.palette.text.disabled,
                }}>
                  {stage.label}
                </Typography>
                {isDone && stage.duration_s != null && (
                  <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled }}>
                    {stage.duration_s}s
                  </Typography>
                )}
              </Box>
            )
          })}
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
      <CircularProgress size={28} thickness={2.5} sx={{ color: theme.palette.primary.main }} />
      <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
        Video is being generated…
      </Typography>
    </Box>
  )
}

// Renders as an inline side panel — no Dialog wrapper.
export default function NodeModal({ node, onClose, onAsk }) {
  const theme  = useTheme()
  const isDark = useIsDark()

  const [framesData,  setFramesData]  = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [activeFrame, setActiveFrame] = useState(0)
  const [question,    setQuestion]    = useState('')

  useEffect(() => {
    if (!node) return
    setActiveFrame(0)
    setQuestion('')

    if (node.framesData) {
      setFramesData(node.framesData)
    } else if (node.render_path !== 'interactive') {
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
  }, [node?.id, node?.framesData, node?.render_path])

  if (!node) return null

  const captions    = framesData?.captions || []
  const hasCaption  = captions.length > 0
  const hasQuestion = Boolean(question.trim())
  const isInteractive = node.render_path === 'interactive'
  const isLoading   = node.isLoading

  const handleAsk = () => {
    if (!hasQuestion) return
    onAsk({
      question:   question.trim(),
      sessionId:  node.id,
      frameIndex: hasCaption ? activeFrame : null,
      caption:    captions[activeFrame] || null,
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      bgcolor: isDark ? '#141414' : '#ffffff',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <Box sx={{
        px: 2, py: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', gap: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {node.intent_type && (
            <Typography sx={{
              display: 'inline-block',
              fontSize: 9.5, fontWeight: 700, px: 0.9, py: 0.25,
              borderRadius: '5px', textTransform: 'capitalize', mb: 0.6,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: theme.palette.text.secondary,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
            }}>
              {formatIntentType(node.intent_type)}
            </Typography>
          )}
          <Typography sx={{
            fontSize: 13, fontWeight: 600,
            color: theme.palette.text.primary, lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {node.prompt}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ flexShrink: 0, mt: 0.25 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Content (scrollable) ── */}
      <Box sx={{
        flex: 1, overflow: 'auto',
        p: isInteractive ? 0 : 2,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
      }}>
        {isLoading ? (
          <LoadingPanel node={node} theme={theme} />
        ) : isInteractive ? (
          <Box sx={{
            px: 2, py: 2,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}>
            {(node.blocks ?? []).length > 0 ? (
              <BlockRenderer
                turnId={node.id ?? node.tempId}
                title={node.title}
                learningObjective={node.learningObjective}
                blocks={node.blocks ?? []}
                isLoading={false}
              />
            ) : (
              <Box sx={{
                px: 2, py: 1.5, borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                border: `1px solid ${theme.palette.divider}`,
              }}>
                <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.secondary, opacity: 0.55, mb: 0.75 }}>
                  Prompt
                </Typography>
                <Typography sx={{ fontSize: 13, color: theme.palette.text.primary, lineHeight: 1.6 }}>
                  {node.prompt}
                </Typography>
              </Box>
            )}
          </Box>
        ) : node.videoPhase === 'generating' ? (
          <VideoGeneratingPlaceholder isDark={isDark} theme={theme} />
        ) : (
          <VideoPanel sessionId={node.id} videoPhase={node.videoPhase} onPauseAsk={null} />
        )}

        {!isInteractive && (
          <>
            {loadingMeta && !captions.length && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                <CircularProgress size={18} />
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

      {/* ── Ask follow-up (pinned bottom) ── */}
      <Box sx={{
        flexShrink: 0, p: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fafafa',
        opacity: isLoading ? 0.45 : 1,
        pointerEvents: isLoading ? 'none' : 'auto',
        transition: 'opacity 0.2s',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
          <QuestionAnswerOutlinedIcon sx={{ fontSize: 13, color: theme.palette.primary.main }} />
          <Typography sx={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', color: theme.palette.primary.main, opacity: 0.85,
          }}>
            {isLoading ? 'Generating…' : 'Ask a follow-up'}
          </Typography>
        </Box>

        {hasCaption && !isLoading && (
          <Chip
            label={`Context: Slide ${activeFrame + 1}`}
            size="small"
            sx={{
              mb: 1.25, fontSize: 10.5, height: 24, cursor: 'default',
              bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
              color: theme.palette.text.secondary,
              border: `1px solid ${neutralBorderDefault(isDark)}`,
              '& .MuiChip-label': { px: 1 },
            }}
          />
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Available once generation completes…' : 'Ask something about this lesson…'}
            disabled={isLoading}
            multiline
            maxRows={3}
            size="small"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: 12.5,
                borderRadius: '10px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
              },
            }}
          />
          <Tooltip title="Ask (Enter)">
            <span>
              <IconButton aria-label="Ask"
                onClick={handleAsk}
                disabled={!hasQuestion || isLoading}
                size="small"
                sx={{
                  width: 34, height: 34, flexShrink: 0,
                  bgcolor: hasQuestion && !isLoading ? theme.palette.primary.main : 'transparent',
                  color: hasQuestion && !isLoading ? '#fff' : theme.palette.text.disabled,
                  border: `1.5px solid ${hasQuestion && !isLoading ? theme.palette.primary.main : theme.palette.divider}`,
                  borderRadius: '9px',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: theme.palette.primary.dark, color: '#fff' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                <SendIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
}
