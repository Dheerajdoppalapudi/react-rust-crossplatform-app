import { useState, useCallback, useRef, useEffect, memo } from 'react'
import PropTypes from 'prop-types'
import {
  Box, Typography, Chip, Dialog, DialogContent, IconButton, useTheme,
} from '@mui/material'
import CloseIcon                  from '@mui/icons-material/Close'
import ArrowBackIosNewIcon         from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon         from '@mui/icons-material/ArrowForwardIos'
import QuestionAnswerOutlinedIcon  from '@mui/icons-material/QuestionAnswerOutlined'
import VideoPanel                  from './VideoPanel'
import FrameThumbnail              from './FrameThumbnail'
import NotesPanel                  from './NotesPanel'
import { getFrameType }            from './constants'
import { useMediaUrl }             from '../../hooks/useMediaUrl'
import { PALETTE }                 from '../../theme/tokens.js'

function NavButton({ onClick, disabled, 'aria-label': ariaLabel, children }) {
  return (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      size="small"
      aria-label={ariaLabel}
      sx={{
        color: '#fff',
        bgcolor: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        '&.Mui-disabled': { opacity: 0.25 },
      }}
    >
      {children}
    </IconButton>
  )
}

function FrameStrip({ sessionId, captions, images, activeFrame, onFrameChange, onExpandFrame }) {
  const theme       = useTheme()
  const isDark      = theme.palette.mode === 'dark'
  const stripRef    = useRef(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Update scroll indicators on mount and when the list scrolls
  const updateScrollIndicators = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollIndicators()
    const el = stripRef.current
    el?.addEventListener('scroll', updateScrollIndicators, { passive: true })
    return () => el?.removeEventListener('scroll', updateScrollIndicators)
  }, [updateScrollIndicators, captions.length])

  // Keyboard navigation: ArrowLeft / ArrowRight cycle through frames
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onFrameChange((f) => Math.min(f + 1, captions.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onFrameChange((f) => Math.max(f - 1, 0))
    }
  }, [captions.length, onFrameChange])

  // Scroll the active thumbnail into view when it changes via keyboard
  useEffect(() => {
    const el    = stripRef.current
    const thumb = el?.children[activeFrame]
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeFrame])

  const fadeBg = isDark ? PALETTE.darkSurface : PALETTE.ivory

  return (
    <Box sx={{ position: 'relative' }}>
      {canScrollLeft && (
        <Box sx={{
          position: 'absolute', left: 0, top: 0, bottom: 8,
          width: 40, zIndex: 1, pointerEvents: 'none',
          background: `linear-gradient(to right, ${fadeBg}, transparent)`,
        }} />
      )}

      <Box
        ref={stripRef}
        role="listbox"
        aria-label="Slides"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        sx={{
          display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5,
          outline: 'none',
          '&::-webkit-scrollbar': { height: 3 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderRadius: 2,
          },
        }}
      >
        {captions.map((caption, i) => (
          <FrameThumbnail
            key={i}
            sessionId={sessionId}
            frameIndex={i}
            caption={caption}
            type={getFrameType(images[i])}
            isActive={activeFrame === i}
            onClick={() => { onFrameChange(i); onExpandFrame(i) }}
            aria-selected={activeFrame === i}
            role="option"
          />
        ))}
      </Box>

      {canScrollRight && (
        <Box sx={{
          position: 'absolute', right: 0, top: 0, bottom: 8,
          width: 40, zIndex: 1, pointerEvents: 'none',
          background: `linear-gradient(to left, ${fadeBg}, transparent)`,
        }} />
      )}
    </Box>
  )
}
FrameStrip = memo(FrameStrip)

function SlideDialog({ open, frameIndex, captions, images, sessionId, onClose, onFrameChange, onAsk }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { getFrameUrl } = useMediaUrl(sessionId)
  const total   = captions.length
  const caption = captions[frameIndex] ?? ''
  const type    = getFrameType(images[frameIndex])
  const imgUrl  = getFrameUrl(frameIndex)
  const [slideLoading, setSlideLoading] = useState(true)

  // Reset shimmer whenever the frame changes
  useEffect(() => { setSlideLoading(true) }, [frameIndex])

  const goPrev = () => onFrameChange((f) => Math.max(f - 1, 0))
  const goNext = () => onFrameChange((f) => Math.min(f + 1, total - 1))

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, frameIndex, total]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      PaperProps={{
        sx: {
          bgcolor: PALETTE.nearBlack,
          borderRadius: '14px',
          overflow: 'hidden',
          width: '90vw',
          maxWidth: 1000,
        },
      }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(6px)', bgcolor: 'rgba(0,0,0,0.75)' } } }}
    >
      <DialogContent sx={{ p: 0, position: 'relative' }}>

        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close full-screen view"
          sx={{
            position: 'absolute', top: 10, right: 10, zIndex: 10,
            color: '#fff', bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>

        <Box sx={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, px: 1.5, py: 0.4, borderRadius: '20px',
          bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
            {frameIndex + 1} / {total}
          </Typography>
        </Box>

        <Box sx={{
          position: 'relative', bgcolor: PALETTE.pureBlack,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Shimmer skeleton while slide loads */}
          {type === 'image' && imgUrl && slideLoading && (
            <Box sx={{
              width: '100%', aspectRatio: '16/9',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
              '&::after': {
                content: '""', display: 'block', width: '100%', height: '100%',
                background: isDark
                  ? 'linear-gradient(90deg,transparent 20%,rgba(255,255,255,0.07) 50%,transparent 80%)'
                  : 'linear-gradient(90deg,transparent 20%,rgba(255,255,255,0.65) 50%,transparent 80%)',
                backgroundSize: '200% 100%',
                animation: 'slideShimmer 1.4s ease-in-out infinite',
              },
              '@keyframes slideShimmer': {
                '0%':   { backgroundPosition: '-200% 0' },
                '100%': { backgroundPosition:  '200% 0' },
              },
            }} />
          )}
          {type === 'image' && imgUrl ? (
            <img
              src={imgUrl}
              alt={caption}
              onLoad={() => setSlideLoading(false)}
              onError={() => setSlideLoading(false)}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block',
                       opacity: slideLoading ? 0 : 1, transition: 'opacity 0.25s' }}
            />
          ) : (
            <Box sx={{
              width: '100%', aspectRatio: '16/9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {caption || `Slide ${frameIndex + 1}`}
              </Typography>
            </Box>
          )}

          {frameIndex > 0 && (
            <Box sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <NavButton onClick={goPrev} disabled={frameIndex === 0} aria-label="Previous slide">
                <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
              </NavButton>
            </Box>
          )}
          {frameIndex < total - 1 && (
            <Box sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <NavButton onClick={goNext} disabled={frameIndex === total - 1} aria-label="Next slide">
                <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
              </NavButton>
            </Box>
          )}
        </Box>

        <Box sx={{
          px: 3, py: 2,
          display: 'flex', alignItems: 'flex-start', gap: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Typography sx={{ flex: 1, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            <Box component="span" sx={{ fontWeight: 700, color: '#fff', mr: 0.75 }}>
              Slide {frameIndex + 1}:
            </Box>
            {caption}
          </Typography>
          {caption && (
            <Chip
              icon={<QuestionAnswerOutlinedIcon sx={{ fontSize: 13 }} />}
              label="Ask about this"
              size="small"
              onClick={() => { onAsk(frameIndex); onClose() }}
              sx={{
                flexShrink: 0, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600, height: 26,
                bgcolor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.20)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
                '& .MuiChip-icon': { color: 'inherit' },
                transition: 'all 0.15s',
              }}
            />
          )}
        </Box>

      </DialogContent>
    </Dialog>
  )
}

function SessionView({ session, videoPhase, framesData, onPauseAsk, notesEnabled }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [activeFrame,   setActiveFrame]   = useState(0)
  const [expandedFrame, setExpandedFrame] = useState(null)

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

      <VideoPanel
        sessionId={session.id}
        videoPhase={videoPhase}
        prompt={session.prompt}
        onPauseAsk={onPauseAsk}
        captions={captions}
        frameCount={captions.length}
        onFrameSync={setActiveFrame}
      />

      {captions.length > 0 && (
        <Box sx={{ pt: 2 }}>
          <Typography sx={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: subText, opacity: 0.4, mb: 1.25,
          }}>
            Slides · {captions.length}
          </Typography>

          <FrameStrip
            sessionId={session.id}
            captions={captions}
            images={images}
            activeFrame={activeFrame}
            onFrameChange={setActiveFrame}
            onExpandFrame={setExpandedFrame}
          />

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
                  bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                  color: theme.palette.text.secondary,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', color: theme.palette.text.primary },
                  '& .MuiChip-icon': { color: 'inherit' },
                  transition: 'all 0.15s',
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {notesEnabled && notes && <NotesPanel notes={notes} />}

      {expandedFrame !== null && captions.length > 0 && (
        <SlideDialog
          open={expandedFrame !== null}
          frameIndex={expandedFrame}
          captions={captions}
          images={images}
          sessionId={session.id}
          onClose={() => setExpandedFrame(null)}
          onFrameChange={(updater) => {
            setExpandedFrame((prev) => {
              const next = typeof updater === 'function' ? updater(prev) : updater
              setActiveFrame(next)
              return next
            })
          }}
          onAsk={handleFrameAsk}
        />
      )}

    </Box>
  )
}

SessionView.propTypes = {
  session:    PropTypes.shape({
    id:         PropTypes.string.isRequired,
    prompt:     PropTypes.string,
    videoPhase: PropTypes.string,
    framesData: PropTypes.object,
  }).isRequired,
  videoPhase:   PropTypes.string.isRequired,
  framesData:   PropTypes.object,
  onPauseAsk:   PropTypes.func.isRequired,
  notesEnabled: PropTypes.bool,
}

export default memo(SessionView, (prev, next) =>
  prev.session      === next.session      &&
  prev.videoPhase   === next.videoPhase   &&
  prev.framesData   === next.framesData   &&
  prev.onPauseAsk   === next.onPauseAsk   &&
  prev.notesEnabled === next.notesEnabled
)
