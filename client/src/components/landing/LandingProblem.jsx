import { useRef } from 'react'
import { Box } from '@mui/material'
import { motion, useInView } from 'framer-motion'
import { useLandingTheme } from './tokens.js'

const M = motion(Box)
const EASE = [0.16, 1, 0.3, 1]

const STATEMENT =
  'Most learning is built for the average. You are not average. The hardest ideas stay locked behind dense pages and one-size-fits-all lectures — until you give up, or pretend you understood.'

function WordReveal({ text, sx = {} }) {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })
  const words  = text.split(' ')
  return (
    <Box ref={ref} component="h2" sx={{
      fontFamily: P.fontDisplay,
      fontSize: 'clamp(28px, 4.8vw, 62px)',
      fontWeight: 700,
      letterSpacing: '-0.025em',
      lineHeight: 1.12,
      color: P.text0,
      margin: 0,
      ...sx,
    }}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: i * 0.045, ease: EASE }}
          style={{ display: 'inline-block', marginRight: '0.3em', marginBottom: '0.05em' }}
        >
          {word}
        </motion.span>
      ))}
    </Box>
  )
}

export default function LandingProblem() {
  const P        = useLandingTheme()
  const footRef  = useRef(null)
  const footInView = useInView(footRef, { once: true, amount: 0.5 })

  return (
    <Box
      component="section"
      sx={{
        bgcolor: P.bg0,
        borderTop: `1px solid ${P.line}`,
        py: { xs: '80px', md: '140px' },
        px: { xs: '5%', md: '8%' },
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ mb: '36px' }}>
          <EyebrowLabel>The problem</EyebrowLabel>
        </Box>

        <WordReveal text={STATEMENT} sx={{ mb: '40px' }} />

        <motion.p
          ref={footRef}
          initial={{ opacity: 0, y: 16 }}
          animate={footInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease: EASE }}
          style={{
            fontFamily: P.fontBody,
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            color: P.text1,
            lineHeight: 1.7,
            maxWidth: 580,
            margin: 0,
          }}
        >
          Curiosity dies in friction. Paralyte removes it — building the
          explanation{' '}
          <Box component="em" sx={{ color: P.green, fontStyle: 'normal' }}>you</Box>
          {' '}needed, the moment you ask.
        </motion.p>
      </Box>
    </Box>
  )
}

export function EyebrowLabel({ children }) {
  const P = useLandingTheme()
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <M
        animate={{ opacity: [1, 0.4, 1], scale: [1, 0.68, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        sx={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          bgcolor: P.green, boxShadow: `0 0 12px 2px rgba(${P.greenRgb},0.8)`,
        }}
      />
      <Box sx={{
        fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 500,
        letterSpacing: '0.28em', textTransform: 'uppercase', color: P.text1,
      }}>
        {children}
      </Box>
    </Box>
  )
}
