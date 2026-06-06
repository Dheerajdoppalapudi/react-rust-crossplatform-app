import { useRef, useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import NeuralCanvas from './NeuralCanvas.jsx'
import LandingPromptInput from './LandingPromptInput.jsx'
import { useLandingTheme } from './tokens.js'

const M = motion(Box)

// A small curated set of the topics, shown as quick-fill chips under the input.
const HERO_CHIPS = ['Backpropagation', 'General relativity', 'Black holes', 'CRISPR gene editing']

const TOPICS = [
  'backpropagation',
  'the Krebs cycle',
  'general relativity',
  'quantum entanglement',
  'the Silk Road',
  'photosynthesis',
  'transformer models',
  'tectonic plates',
  'black holes',
  'game theory',
  'CRISPR gene editing',
  'the Big Bang',
]

const EASE = [0.16, 1, 0.3, 1]

export default function LandingHero() {
  const P        = useLandingTheme()
  const [display, setDisplay] = useState(TOPICS[0])
  const timerRef = useRef(null)

  useEffect(() => {
    let idx = 0
    let charIdx = TOPICS[0].length
    let mode = 'pause'

    const step = () => {
      if (mode === 'pause') {
        mode = 'deleting'
        timerRef.current = setTimeout(step, 1800)
      } else if (mode === 'deleting') {
        if (charIdx > 0) {
          charIdx--
          setDisplay(TOPICS[idx].slice(0, charIdx))
          timerRef.current = setTimeout(step, 52)
        } else {
          idx = (idx + 1) % TOPICS.length
          charIdx = 0
          mode = 'typing'
          timerRef.current = setTimeout(step, 130)
        }
      } else {
        if (charIdx < TOPICS[idx].length) {
          charIdx++
          setDisplay(TOPICS[idx].slice(0, charIdx))
          timerRef.current = setTimeout(step, 38 + Math.random() * 44)
        } else {
          mode = 'pause'
          timerRef.current = setTimeout(step, 200)
        }
      }
    }
    timerRef.current = setTimeout(step, 1800)
    return () => clearTimeout(timerRef.current)
  }, [])

  // Gradient line 2 adapts to mode
  const gradientH1 = P.isDark
    ? `linear-gradient(105deg, #fff 0%, ${P.green} 55%, ${P.cyan} 100%)`
    : `linear-gradient(105deg, ${P.text0} 0%, ${P.green} 55%, ${P.cyan} 100%)`

  return (
    <Box
      component="section"
      sx={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', justifyContent: 'center',
        // `safe center` keeps the content vertically centred, but when it's
        // taller than the viewport (long topic / short window) it pins to the
        // top instead of overflowing upward behind the sticky header.
        alignItems: 'safe center',
        // Reserve room for the fixed header (76px) plus breathing space.
        pt: { xs: '104px', md: '120px' },
        pb: { xs: '72px', md: '88px' },
        overflow: 'hidden', bgcolor: P.bg0,
      }}
    >
      {/* Neural canvas — visible in dark, subtle in light */}
      <NeuralCanvas style={{ opacity: P.isDark ? 1 : 0.25 }} />

      {/* Central glow */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 50% at 50% 30%, rgba(${P.greenRgb},${P.isDark ? '0.055' : '0.08'}) 0%, transparent 68%)`,
      }} />

      {/* Content */}
      <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', px: { xs: '5%', md: '6%' }, maxWidth: 1280, mx: 'auto' }}>

        {/* Headline line 1 */}
        <Box sx={{ overflow: 'hidden' }}>
          <motion.h1
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.95, ease: EASE, delay: 0.1 }}
            style={{
              margin: 0,
              fontFamily: P.fontDisplay,
              fontSize: 'clamp(46px, 8vw, 110px)',
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.03,
              color: P.text0,
            }}
          >
            Understand
          </motion.h1>
        </Box>

        {/* Headline line 2 — gradient + typed topic */}
        <Box sx={{ overflow: 'hidden', mb: '28px' }}>
          <motion.h1
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.95, ease: EASE, delay: 0.22 }}
            style={{
              margin: 0,
              fontFamily: P.fontDisplay,
              fontSize: 'clamp(46px, 8vw, 110px)',
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.03,
            }}
          >
            {/* Gradient is clipped to an inline-block span (hugs the text width)
                so it never paints as a full-width bar if the browser drops the
                background-clip during a theme repaint. The `key` forces a fresh
                clip when the gradient changes on theme toggle. */}
            <Box
              key={P.isDark ? 'g-dark' : 'g-light'}
              component="span"
              sx={{
                display: 'inline-block',
                background: gradientH1,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {display || '​'}
            </Box>
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: '3px',
                height: '0.74em',
                bgcolor: P.green,
                ml: '4px',
                verticalAlign: 'baseline',
                boxShadow: `0 0 10px ${P.green}`,
                animation: 'blink 1.1s step-end infinite',
                '@keyframes blink': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0 },
                },
              }}
            />
          </motion.h1>
        </Box>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.52 }}
          style={{
            fontFamily: P.fontBody,
            fontSize: 'clamp(15px, 1.8vw, 19px)',
            color: P.text1,
            lineHeight: 1.6,
            maxWidth: 680,
            margin: '0 auto 44px',
          }}
        >
          Make the hardest concepts in the world accessible to anyone — through
          AI-generated video, structured notes, and a canvas that maps how knowledge grows.
        </motion.p>

        {/* Prompt box — the primary action */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE, delay: 0.68 }}
        >
          <LandingPromptInput
            placeholder="Ask anything — or paste a problem you're stuck on"
            chips={HERO_CHIPS}
          />
        </motion.div>
      </Box>

      {/* Scroll indicator — mouse + animated dot */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          zIndex: 1,
        }}
      >
        {/* Mouse shell */}
        <Box sx={{
          width: 24, height: 38, borderRadius: '12px',
          border: `1.5px solid rgba(${P.greenRgb},0.35)`,
          display: 'flex', justifyContent: 'center',
          pt: '6px', boxSizing: 'border-box',
        }}>
          <M
            animate={{ y: [0, 12, 0], opacity: [0.9, 0.15, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            sx={{ width: 3, height: 6, borderRadius: '2px', bgcolor: P.green, flexShrink: 0 }}
          />
        </Box>
        <Box sx={{ fontFamily: P.fontMono, fontSize: 10, letterSpacing: '0.2em', color: P.text2, textTransform: 'uppercase' }}>
          scroll
        </Box>
      </motion.div>
    </Box>
  )
}
