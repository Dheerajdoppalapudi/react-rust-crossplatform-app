import { useState, useEffect } from 'react'
import { Box, Typography, IconButton, useTheme } from '@mui/material'
import ArrowBackIcon    from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { motion, AnimatePresence } from 'framer-motion'
import { useSceneStore } from '../useSceneStore'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

const MotionDiv = motion.div

export default function FlashcardDeck({
  entityId,
  cards       = [],
  stepReveal  = false,
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const storeStep = useSceneStore(s => s.getStep(entityId))

  const [localIndex, setLocalIndex] = useState(0)
  const [flipped,    setFlipped]    = useState(false)

  const currentIndex = stepReveal ? storeStep : localIndex

  // Reset flip when card changes
  useEffect(() => { setFlipped(false) }, [currentIndex])

  if (!cards.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        flashcard_deck: "cards" array is required
      </Box>
    )
  }

  const card     = cards[Math.min(currentIndex, cards.length - 1)]
  const atStart  = currentIndex === 0
  const atEnd    = currentIndex === cards.length - 1

  function prev() {
    if (!stepReveal) setLocalIndex(i => Math.max(0, i - 1))
  }
  function next() {
    if (!stepReveal) setLocalIndex(i => Math.min(cards.length - 1, i + 1))
  }

  const frontBg = isDark
    ? 'linear-gradient(135deg, rgba(75,114,255,0.12) 0%, rgba(107,68,248,0.08) 100%)'
    : 'linear-gradient(135deg, rgba(75,114,255,0.07) 0%, rgba(107,68,248,0.04) 100%)'

  const backBg = isDark
    ? 'linear-gradient(135deg, rgba(107,68,248,0.14) 0%, rgba(75,114,255,0.10) 100%)'
    : 'linear-gradient(135deg, rgba(107,68,248,0.07) 0%, rgba(75,114,255,0.04) 100%)'

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: `${RADIUS.lg}px`,
        p: 2,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        {/* Flip card area */}
        <Box
          onClick={() => setFlipped(f => !f)}
          sx={{
            perspective: '1000px',
            cursor: 'pointer',
            height: 200,
            mb: 2,
            userSelect: 'none',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!flipped ? (
              <MotionDiv
                key={`front-${currentIndex}`}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0,   opacity: 1 }}
                exit={{   rotateY: 90,   opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{ height: '100%' }}
              >
                <Box sx={{
                  height: '100%',
                  borderRadius: `${RADIUS.md}px`,
                  background: frontBg,
                  border: `1px solid ${isDark ? 'rgba(75,114,255,0.2)' : 'rgba(75,114,255,0.15)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                  position: 'relative',
                }}>
                  {/* Front label */}
                  <Typography sx={{
                    position: 'absolute', top: 10, left: 14,
                    fontSize: 10, fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Question
                  </Typography>

                  <Typography sx={{
                    fontSize: TYPOGRAPHY.sizes.body,
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}>
                    {card.front}
                  </Typography>

                  {card.hint && (
                    <Typography sx={{
                      position: 'absolute', bottom: 10,
                      fontSize: TYPOGRAPHY.sizes.caption,
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                      fontStyle: 'italic',
                      textAlign: 'center',
                      px: 2,
                    }}>
                      💡 {card.hint}
                    </Typography>
                  )}

                  {/* Tap to flip hint */}
                  <Typography sx={{
                    position: 'absolute', bottom: card.hint ? 28 : 10,
                    fontSize: 10,
                    color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
                    letterSpacing: '0.04em',
                  }}>
                    tap to flip
                  </Typography>
                </Box>
              </MotionDiv>
            ) : (
              <MotionDiv
                key={`back-${currentIndex}`}
                initial={{ rotateY: 90,  opacity: 0 }}
                animate={{ rotateY: 0,   opacity: 1 }}
                exit={{   rotateY: -90,  opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{ height: '100%' }}
              >
                <Box sx={{
                  height: '100%',
                  borderRadius: `${RADIUS.md}px`,
                  background: backBg,
                  border: `1px solid ${isDark ? 'rgba(107,68,248,0.25)' : 'rgba(107,68,248,0.15)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                  position: 'relative',
                }}>
                  {/* Back label */}
                  <Typography sx={{
                    position: 'absolute', top: 10, left: 14,
                    fontSize: 10, fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Answer
                  </Typography>

                  <Typography sx={{
                    fontSize: TYPOGRAPHY.sizes.bodySm,
                    color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}>
                    {card.back}
                  </Typography>
                </Box>
              </MotionDiv>
            )}
          </AnimatePresence>
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <IconButton
            size="small"
            onClick={prev}
            disabled={atStart || stepReveal}
            aria-label="Previous card"
            sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>

          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            minWidth: 40,
            textAlign: 'center',
          }}>
            {currentIndex + 1} / {cards.length}
          </Typography>

          <IconButton
            size="small"
            onClick={next}
            disabled={atEnd || stepReveal}
            aria-label="Next card"
            sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
          >
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
