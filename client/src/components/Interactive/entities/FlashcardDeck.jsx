import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, IconButton, useTheme } from '@mui/material'
import { useExpanded } from '../BlockWrapper'
import ArrowBackIcon    from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ShuffleIcon      from '@mui/icons-material/Shuffle'
import { motion, AnimatePresence } from 'framer-motion'
import { useSceneStore } from '../useSceneStore'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

const MotionDiv = motion.div

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CONFIDENCE = [
  { key: 'again', label: 'Again', color: '#f85149', bg: 'rgba(248,81,73,0.12)' },
  { key: 'hard',  label: 'Hard',  color: '#f0883e', bg: 'rgba(240,136,62,0.12)' },
  { key: 'good',  label: 'Good',  color: '#2ea043', bg: 'rgba(46,160,67,0.12)' },
  { key: 'easy',  label: 'Easy',  color: '#58a6ff', bg: 'rgba(88,166,255,0.12)' },
]

export default function FlashcardDeck({
  entityId,
  cards       = [],
  stepReveal  = false,
  reviewMode  = 'linear',
  caption,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  const storeStep = useSceneStore(s => s.getStep(entityId))

  // Shuffle once when cards or mode changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayCards = useMemo(
    () => (reviewMode === 'shuffle' || reviewMode === 'spaced') ? shuffleArray(cards) : cards,
    [cards.length, reviewMode] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [localIndex, setLocalIndex] = useState(0)
  const [flipped,    setFlipped]    = useState(false)
  const [confidence, setConfidence] = useState({}) // index → 'again'|'hard'|'good'|'easy'

  const currentIndex = stepReveal ? storeStep : localIndex

  useEffect(() => { setFlipped(false) }, [currentIndex])

  if (!cards.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        flashcard_deck: "cards" array is required
      </Box>
    )
  }

  const card    = displayCards[Math.min(currentIndex, displayCards.length - 1)]
  const atStart = currentIndex === 0
  const atEnd   = currentIndex === displayCards.length - 1
  const mastered = Object.values(confidence).filter(c => c === 'good' || c === 'easy').length

  function prev() { if (!stepReveal) setLocalIndex(i => Math.max(0, i - 1)) }
  function next() { if (!stepReveal) setLocalIndex(i => Math.min(displayCards.length - 1, i + 1)) }

  function markConfidence(level) {
    setConfidence(prev => ({ ...prev, [currentIndex]: level }))
    setFlipped(false)
    if (!atEnd) setLocalIndex(i => i + 1)
  }

  const frontBg = isDark
    ? 'linear-gradient(135deg, rgba(75,114,255,0.12) 0%, rgba(107,68,248,0.08) 100%)'
    : 'linear-gradient(135deg, rgba(75,114,255,0.07) 0%, rgba(107,68,248,0.04) 100%)'

  const backBg = isDark
    ? 'linear-gradient(135deg, rgba(107,68,248,0.14) 0%, rgba(75,114,255,0.10) 100%)'
    : 'linear-gradient(135deg, rgba(107,68,248,0.07) 0%, rgba(75,114,255,0.04) 100%)'

  const showConfidenceButtons = reviewMode === 'spaced' && flipped

  return (
    <Box>
      <Box sx={{
        border: isExpanded ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        p: isExpanded ? 3 : 2,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        {/* Mode label + spaced progress */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          {reviewMode !== 'linear' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ShuffleIcon sx={{ fontSize: 12, opacity: 0.35 }} />
              <Typography sx={{ fontSize: 10, opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {reviewMode}
              </Typography>
            </Box>
          ) : <Box />}
          {reviewMode === 'spaced' && (
            <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
              {mastered} / {displayCards.length} mastered
            </Typography>
          )}
        </Box>

        {/* Card flip area */}
        <Box
          onClick={() => setFlipped(f => !f)}
          sx={{ perspective: '1000px', cursor: 'pointer', height: 200, mb: 2, userSelect: 'none' }}
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
                  height: '100%', borderRadius: `${RADIUS.md}px`, background: frontBg,
                  border: `1px solid ${isDark ? 'rgba(75,114,255,0.2)' : 'rgba(75,114,255,0.15)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  p: 3, position: 'relative',
                }}>
                  <Typography sx={{
                    position: 'absolute', top: 10, left: 14, fontSize: 10,
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Question
                  </Typography>
                  <Typography sx={{
                    fontSize: TYPOGRAPHY.sizes.body, fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                    textAlign: 'center', lineHeight: 1.5,
                  }}>
                    {card.front}
                  </Typography>
                  {card.hint && (
                    <Typography sx={{
                      position: 'absolute', bottom: 10,
                      fontSize: TYPOGRAPHY.sizes.caption,
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                      fontStyle: 'italic', textAlign: 'center', px: 2,
                    }}>
                      💡 {card.hint}
                    </Typography>
                  )}
                  <Typography sx={{
                    position: 'absolute', bottom: card.hint ? 28 : 10, fontSize: 10,
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
                  height: '100%', borderRadius: `${RADIUS.md}px`, background: backBg,
                  border: `1px solid ${isDark ? 'rgba(107,68,248,0.25)' : 'rgba(107,68,248,0.15)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  p: 3, position: 'relative',
                }}>
                  <Typography sx={{
                    position: 'absolute', top: 10, left: 14, fontSize: 10,
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Answer
                  </Typography>
                  <Typography sx={{
                    fontSize: TYPOGRAPHY.sizes.bodySm,
                    color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
                    textAlign: 'center', lineHeight: 1.6,
                  }}>
                    {card.back}
                  </Typography>
                </Box>
              </MotionDiv>
            )}
          </AnimatePresence>
        </Box>

        {/* Spaced repetition confidence buttons */}
        {showConfidenceButtons ? (
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {CONFIDENCE.map(({ key, label, color, bg }) => (
              <Box
                key={key}
                onClick={() => markConfidence(key)}
                sx={{
                  px: 1.5, py: 0.5, borderRadius: `${RADIUS.md}px`,
                  border: `1.5px solid ${color}`, backgroundColor: bg,
                  cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s ease',
                  '&:hover': { transform: 'scale(1.06)' },
                }}
              >
                <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, fontWeight: TYPOGRAPHY.weights.semibold, color }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          /* Linear / shuffle navigation */
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <IconButton
              size="small" onClick={prev} disabled={atStart || stepReveal}
              aria-label="Previous card"
              sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography sx={{
              fontSize: TYPOGRAPHY.sizes.caption,
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              minWidth: 40, textAlign: 'center',
            }}>
              {currentIndex + 1} / {displayCards.length}
            </Typography>
            <IconButton
              size="small" onClick={next} disabled={atEnd || stepReveal}
              aria-label="Next card"
              sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
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
