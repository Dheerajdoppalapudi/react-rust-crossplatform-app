import { useRef } from 'react'
import { Box } from '@mui/material'
import { motion, useInView } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import StarsCanvas from './StarsCanvas.jsx'
import { useLandingTheme } from './tokens.js'
import ParalyteLogo from '../common/ParalyteLogo.jsx'

const M    = motion(Box)
const EASE = [0.16, 1, 0.3, 1]

// ─── Data ─────────────────────────────────────────────────────────────────────
const LOGOS = ['MIT', 'Stanford', 'ETH Zürich', 'UCL', 'NTU', 'IIT Delhi']

const VISION_WORDS = [
  'Knowledge', 'should', 'expand', 'to', 'fit', 'the', 'mind',
  'asking', 'for', 'it.', 'Not', 'the', 'other', 'way', 'around.',
]

const FOOTER_NAV = [
  { heading: 'Product', links: ['How it works', 'The studio', 'Stories', 'Pricing'] },
  { heading: 'Company', links: ['Vision', 'Careers', 'Research', 'Contact'] },
  { heading: 'Legal',   links: ['Privacy', 'Terms', 'Security'] },
]

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats() {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })

  const STATS = [
    { value: '3.2×', label: 'faster concept retention vs. passive reading', color: P.green  },
    { value: '142k', label: 'explanations generated across all topics',     color: P.cyan   },
    { value: '94%',  label: 'of users understood on the first attempt',     color: P.violet },
  ]

  return (
    <Box component="section" sx={{ bgcolor: P.bg0, borderTop: `1px solid ${P.line}`, py: { xs: '80px', md: '120px' } }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: '5%', md: '6%' } }} ref={ref}>

        <M initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease: EASE }}>
          <Box sx={{ mb: { xs: 8, md: 12 }, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
            <Box component="blockquote" sx={{ m: 0, p: 0, fontFamily: P.fontDisplay, fontSize: 'clamp(20px, 3.2vw, 38px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2, color: P.text0 }}>
              <Box component="span" sx={{ color: P.green }}>&ldquo;</Box>
              The clearest explanation I&apos;ve ever encountered — and it was built for my exact question in under a minute.
              <Box component="span" sx={{ color: P.green }}>&rdquo;</Box>
            </Box>
            <Box sx={{ mt: '20px', fontFamily: P.fontBody, fontSize: 14, color: P.text2, letterSpacing: '0.04em' }}>
              — Graduate researcher, computational neuroscience
            </Box>
          </Box>
        </M>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: { xs: 4, md: 2 }, mb: { xs: 8, md: 12 } }}>
          {STATS.map((s, i) => (
            <M key={i} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}>
              <Box sx={{ textAlign: 'center', p: '32px 24px', borderRadius: '16px', border: `1px solid ${P.line}`, bgcolor: P.surface, position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '1px', bgcolor: s.color, opacity: 0.5, borderRadius: '0 0 4px 4px', boxShadow: `0 0 12px ${s.color}` }} />
                <Box sx={{ fontFamily: P.fontDisplay, fontSize: 'clamp(38px, 5vw, 56px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: s.color, mb: 1.5 }}>
                  {s.value}
                </Box>
                <Box sx={{ fontFamily: P.fontBody, fontSize: 14.5, color: P.text1, lineHeight: 1.55 }}>
                  {s.label}
                </Box>
              </Box>
            </M>
          ))}
        </Box>

        <M initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ fontFamily: P.fontMono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: P.text2, mb: '20px' }}>
              Used by learners from
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: { xs: '16px 24px', md: '10px 32px' } }}>
              {LOGOS.map((name, i) => (
                <Box key={i} sx={{ fontFamily: P.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '0.04em', color: P.text2, px: '14px', py: '7px', borderRadius: '8px', border: `1px solid ${P.line}`, opacity: 0.75 }}>
                  {name}
                </Box>
              ))}
            </Box>
          </Box>
        </M>
      </Box>
    </Box>
  )
}

// ─── Vision ───────────────────────────────────────────────────────────────────
function Vision() {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.25 })

  return (
    <Box component="section" sx={{ position: 'relative', bgcolor: '#020608', borderTop: `1px solid rgba(${P.greenRgb},0.10)`, py: { xs: '100px', md: '160px' }, overflow: 'hidden' }}>
      <StarsCanvas />
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 55% 55% at 50% 50%, rgba(${P.greenRgb},0.05) 0%, transparent 70%)` }} />

      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 180, height: 180, borderRadius: '50%', pointerEvents: 'none' }}>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, rgba(${P.greenRgb},0.07) 0%, transparent 70%)`, animation: 'orbPulse 5s ease infinite', '@keyframes orbPulse': { '0%,100%': { transform: 'scale(1)', opacity: 0.6 }, '50%': { transform: 'scale(1.3)', opacity: 1 } } }} />
        <Box sx={{ position: 'absolute', inset: '35%', borderRadius: '50%', bgcolor: `rgba(${P.greenRgb},0.12)`, boxShadow: `0 0 60px 20px rgba(${P.greenRgb},0.08)`, animation: 'orbPulse 5s ease infinite reverse' }} />
      </Box>

      <Box ref={ref} sx={{ position: 'relative', zIndex: 1, maxWidth: 1100, mx: 'auto', px: { xs: '5%', md: '6%' }, textAlign: 'center' }}>
        <Box component="h2" sx={{ fontFamily: P.fontDisplay, fontSize: 'clamp(30px, 5.5vw, 68px)', fontWeight: 700, letterSpacing: '-0.028em', lineHeight: 1.15, color: '#ecf4f0', margin: '0 0 32px' }}>
          {VISION_WORDS.map((word, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }} style={{ display: 'inline-block', marginRight: '0.3em', marginBottom: '0.06em' }}>
              {word}
            </motion.span>
          ))}
        </Box>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease: EASE, delay: VISION_WORDS.length * 0.05 + 0.1 }}
          style={{ fontFamily: P.fontBody, fontSize: 'clamp(15px, 1.8vw, 19px)', color: '#9bb3ab', lineHeight: 1.65, maxWidth: 680, margin: '0 auto 44px' }}
        >
          Paralyte is a thinking machine for understanding — built to move at the speed of curiosity, not the pace of a textbook.
        </motion.p>

        <M
          initial={{ scaleX: 0, opacity: 0 }}
          animate={inView ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ duration: 1.1, ease: EASE, delay: 0.8 }}
          style={{ height: 1, background: `linear-gradient(90deg, transparent, ${P.green}, transparent)`, maxWidth: 240, margin: '0 auto', boxShadow: `0 0 12px rgba(${P.greenRgb},0.4)` }}
        />
      </Box>
    </Box>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTA() {
  const P        = useLandingTheme()
  const ref      = useRef(null)
  const inView   = useInView(ref, { once: true, amount: 0.35 })
  const navigate = useNavigate()

  return (
    <Box component="section" sx={{ bgcolor: P.bg1, borderTop: `1px solid ${P.line}`, py: { xs: '100px', md: '160px' }, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 60% at 50% 100%, rgba(${P.greenRgb},0.06) 0%, transparent 65%)` }} />

      <Box ref={ref} sx={{ position: 'relative', zIndex: 1, maxWidth: 1100, mx: 'auto', px: { xs: '5%', md: '6%' }, textAlign: 'center' }}>
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease: EASE }}
          style={{ fontFamily: P.fontDisplay, fontSize: 'clamp(32px, 5.5vw, 66px)', fontWeight: 700, letterSpacing: '-0.032em', lineHeight: 1.05, color: P.text0, margin: '0 0 20px' }}
        >
          Your next breakthrough starts with a question.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          style={{ fontFamily: P.fontBody, fontSize: 'clamp(15px, 1.8vw, 18px)', color: P.text1, lineHeight: 1.7, maxWidth: 620, margin: '0 auto 44px' }}
        >
          Ask anything. Paralyte builds the explanation around your understanding — not around what everyone else already knows.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
          style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Box
            component={motion.div}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(ROUTES.STUDIO)}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1.25,
              px: '28px', py: '16px', borderRadius: '100px',
              bgcolor: P.pine, color: '#eafff7',
              fontFamily: P.fontDisplay, fontSize: 16.5, fontWeight: 500,
              cursor: 'pointer', userSelect: 'none',
              animation: 'breathe 4.5s ease infinite',
              '@keyframes breathe': {
                '0%,100%': { boxShadow: `0 0 30px -4px rgba(${P.greenRgb},0.45), inset 0 1px 0 rgba(255,255,255,0.12)` },
                '50%':     { boxShadow: `0 0 50px 4px rgba(${P.greenRgb},0.65), inset 0 1px 0 rgba(255,255,255,0.12)` },
              },
              '&:hover': { bgcolor: P.pineHover },
            }}
          >
            Start Learning — It&apos;s Free
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.text2, marginTop: 16 }}
        >
          No credit card · No sign-up required to try
        </motion.p>
      </Box>
    </Box>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function FooterLogo() {
  const P = useLandingTheme()
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <ParalyteLogo sx={{ fontSize: 30, color: P.green }} />
      <Box sx={{ fontFamily: P.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: P.text0 }}>
        Paralyte
      </Box>
    </Box>
  )
}

function Footer() {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.1 })

  const wordmarkGradient = P.isDark
    ? 'linear-gradient(180deg, rgba(236,244,240,0.18) 0%, rgba(38,224,168,0.05) 100%)'
    : 'linear-gradient(180deg, rgba(7,21,16,0.10) 0%, rgba(11,140,98,0.04) 100%)'

  return (
    <Box component="footer" ref={ref} sx={{ bgcolor: P.bg0, borderTop: `1px solid ${P.line}`, pt: '70px', pb: '40px', overflow: 'hidden' }}>
      <Box sx={{ width: '100%', px: { xs: '5%', md: '6%' } }}>

        <M initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '40px' }}>
            <FooterLogo />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: '32px 48px', md: '0 56px' } }}>
              {FOOTER_NAV.map(col => (
                <Box key={col.heading} sx={{ minWidth: 120 }}>
                  <Box sx={{ fontFamily: P.fontMono, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.text2, fontWeight: 500, mb: '16px' }}>
                    {col.heading}
                  </Box>
                  {col.links.map(link => (
                    <Box key={link} component="a" href="#" sx={{ display: 'block', color: P.text1, fontFamily: P.fontBody, fontSize: 15, mb: '11px', textDecoration: 'none', transition: 'color 0.25s', '&:hover': { color: P.text0 } }}>
                      {link}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </M>

        <M initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 1.2, ease: EASE, delay: 0.15 }}>
          <Box sx={{ mt: '64px', textAlign: 'center', fontFamily: P.fontDisplay, fontWeight: 700, fontSize: 'clamp(64px, 18vw, 230px)', letterSpacing: '-0.05em', lineHeight: 1, background: wordmarkGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', userSelect: 'none' }}>
            Paralyte
          </Box>
        </M>

        <Box sx={{ mt: '30px', pt: '26px', borderTop: `1px solid ${P.line}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ fontFamily: P.fontBody, fontSize: 13, color: P.text2 }}>
            © {new Date().getFullYear()} Paralyte, Inc. Make the hardest things reachable.
          </Box>
          <Box sx={{ display: 'flex', gap: '18px' }}>
            {['X', 'GitHub', 'LinkedIn'].map(s => (
              <Box key={s} component="a" href="#" sx={{ color: P.text2, fontFamily: P.fontBody, fontSize: 13, textDecoration: 'none', transition: 'color 0.25s', '&:hover': { color: P.green } }}>
                {s}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Composed export ──────────────────────────────────────────────────────────
export default function LandingEnd() {
  return (
    <>
      <Stats />
      <Vision />
      <CTA />
      <Footer />
    </>
  )
}
