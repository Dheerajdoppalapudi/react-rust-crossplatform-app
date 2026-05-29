import { useRef, useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import NeuralCanvas from './NeuralCanvas.jsx'
import { useLandingTheme } from './tokens.js'

const M = motion(Box)

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
  const navigate = useNavigate()
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              background: gradientH1,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {display}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: '3px',
                height: '0.82em',
                bgcolor: P.green,
                ml: '3px',
                verticalAlign: 'text-bottom',
                boxShadow: `0 0 10px ${P.green}`,
                animation: 'blink 1.1s step-end infinite',
                WebkitTextFillColor: P.green,
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

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE, delay: 0.68 }}
          style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <M
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(ROUTES.STUDIO)}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1.25,
              px: '26px', py: '15px', borderRadius: '100px',
              bgcolor: P.pine, color: '#eafff7',
              fontFamily: P.fontDisplay, fontSize: 16, fontWeight: 500,
              cursor: 'pointer', userSelect: 'none', border: 'none',
              animation: 'breathe 4.5s ease infinite',
              '@keyframes breathe': {
                '0%, 100%': { boxShadow: `0 0 26px -4px rgba(${P.greenRgb},0.45), inset 0 1px 0 rgba(255,255,255,0.12)` },
                '50%':       { boxShadow: `0 0 46px 2px rgba(${P.greenRgb},0.65),  inset 0 1px 0 rgba(255,255,255,0.12)` },
              },
              '&:hover': { bgcolor: P.pineHover },
            }}
          >
            Start Learning
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </M>

          <M
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            sx={{
              display: 'inline-flex', alignItems: 'center',
              px: '26px', py: '13px', borderRadius: '100px',
              border: `1px solid rgba(${P.greenRgb},0.28)`,
              color: P.text0, bgcolor: 'transparent',
              fontFamily: P.fontDisplay, fontSize: 16, fontWeight: 500,
              cursor: 'pointer', userSelect: 'none',
              transition: 'border-color 0.3s',
              '&:hover': { borderColor: `rgba(${P.greenRgb},0.55)` },
            }}
          >
            See it think
          </M>
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
