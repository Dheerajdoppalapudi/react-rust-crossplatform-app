import { useState, useCallback } from 'react'
import { Box, Typography, Chip, useTheme } from '@mui/material'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import VideoPanel     from './VideoPanel'
import FrameThumbnail from './FrameThumbnail'
import NotesPanel     from './NotesPanel'
import { getFrameType } from './constants'

export default function SessionView({ session, videoPhase, framesData, onPauseAsk }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [activeFrame, setActiveFrame] = useState(0)

  const captions = framesData?.captions || []
  const images   = framesData?.images   || []
  const notes    = framesData?.notes

  const handleFrameAsk = useCallback((idx) => {
    onPauseAsk?.({
      sessionId:  session.id,
      frameIndex: idx,
      caption:    captions[idx] ?? null,
    })
  }, [session.id, captions, onPauseAsk])

  const subText = theme.palette.text.secondary
  const subLine = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Video ─────────────────────────────────────────────────────────── */}
      <VideoPanel
        sessionId={session.id}
        videoPhase={videoPhase}
        onPauseAsk={onPauseAsk}
      />

      {/* ── Frame strip ───────────────────────────────────────────────────── */}
      {captions.length > 0 && (
        <Box sx={{ pt: 2 }}>

          {/* Label */}
          <Typography sx={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: subText, opacity: 0.4, mb: 1.25,
          }}>
            Slides · {captions.length}
          </Typography>

          {/* Thumbnails */}
          <Box sx={{
            display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5,
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 2,
            },
          }}>
            {captions.map((caption, i) => (
              <FrameThumbnail
                key={i}
                sessionId={session.id}
                frameIndex={i}
                caption={caption}
                type={getFrameType(images[i])}
                isActive={activeFrame === i}
                onClick={() => setActiveFrame(i)}
              />
            ))}
          </Box>

          {/* Selected frame caption + ask chip */}
          {captions[activeFrame] && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              mt: 1.25, pt: 1.25,
              borderTop: `1px solid ${subLine}`,
            }}>
              <Typography sx={{ fontSize: 12.5, color: subText, lineHeight: 1.55, flex: 1 }}>
                <Box component="span" sx={{ fontWeight: 600, color: theme.palette.text.primary, mr: 0.5 }}>
                  Slide {activeFrame + 1}:
                </Box>
                {captions[activeFrame]}
              </Typography>

              <Chip
                icon={<QuestionAnswerOutlinedIcon sx={{ fontSize: 13 }} />}
                label="Ask about this"
                size="small"
                onClick={() => handleFrameAsk(activeFrame)}
                sx={{
                  flexShrink: 0, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, height: 26,
                  bgcolor: isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff',
                  color: theme.palette.primary.main,
                  border: `1px solid ${isDark ? 'rgba(79,110,255,0.25)' : '#c7d2fe'}`,
                  '&:hover': { bgcolor: isDark ? 'rgba(79,110,255,0.2)' : '#e0e8ff' },
                  '& .MuiChip-icon': { color: 'inherit' },
                  transition: 'all 0.15s',
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {notes && <NotesPanel notes={notes} />}

    </Box>
  )
}
