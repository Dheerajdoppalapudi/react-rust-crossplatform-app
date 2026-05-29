import { useRef, useState, useEffect, useCallback } from 'react'
import { Box } from '@mui/material'
import { motion, useInView } from 'framer-motion'
import { useLandingTheme } from './tokens.js'
import { EyebrowLabel } from './LandingProblem.jsx'

const M = motion(Box)
const EASE = [0.16, 1, 0.3, 1]
const PROMPT = 'How does backpropagation work?'

export default function LandingDemo() {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })

  const PANELS = [
    { id: 'video',    label: 'AI Video',         color: P.green  },
    { id: 'notes',    label: 'Structured Notes', color: P.cyan   },
    { id: 'research', label: 'Research',         color: P.violet },
    { id: 'canvas',   label: 'Canvas',           color: P.green  },
  ]
  const DELAYS = [1200, 2000, 2800, 3600]

  const [typed,    setTyped]    = useState('')
  const [status,   setStatus]   = useState('idle')
  const [revealed, setRevealed] = useState([])
  const timerRef = useRef([])

  const clear = () => { timerRef.current.forEach(clearTimeout); timerRef.current = [] }

  const run = useCallback(() => {
    clear()
    setTyped(''); setStatus('idle'); setRevealed([])
    let charIdx = 0
    const typeNext = () => {
      charIdx++
      setTyped(PROMPT.slice(0, charIdx))
      if (charIdx < PROMPT.length) timerRef.current.push(setTimeout(typeNext, 28 + Math.random() * 36))
      else {
        timerRef.current.push(setTimeout(() => setStatus('generating'), 320))
        DELAYS.forEach((delay, i) => {
          timerRef.current.push(setTimeout(() => {
            setRevealed(prev => [...prev, PANELS[i].id])
            if (i === PANELS.length - 1) setStatus('done')
          }, delay))
        })
      }
    }
    timerRef.current.push(setTimeout(() => { setStatus('typing'); typeNext() }, 600))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (inView) run() }, [inView, run])
  useEffect(() => () => clear(), [])

  const boxShadow = P.isDark ? '0 40px 80px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.12)'

  return (
    <Box component="section" sx={{ bgcolor: P.bg1, borderTop: `1px solid ${P.line}`, py: { xs: '80px', md: '140px' } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: '5%', md: '6%' } }}>

        {/* Head */}
        <Box ref={ref} sx={{ mb: { xs: 6, md: 8 }, textAlign: 'center' }}>
          <Box sx={{ mb: 2 }}><EyebrowLabel>See it think</EyebrowLabel></Box>
          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: EASE }}
            style={{ fontFamily: P.fontDisplay, fontSize: 'clamp(26px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.028em', lineHeight: 1.1, color: P.text0, margin: '0 0 14px' }}
          >
            One question. Four answers. Instantly.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            style={{ fontFamily: P.fontBody, fontSize: 16, color: P.text1, lineHeight: 1.7, margin: '0 auto', maxWidth: 480 }}
          >
            Watch Paralyte receive a question and build a complete learning space in seconds.
          </motion.p>
        </Box>

        {/* Studio mockup */}
        <M initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}>
          <Box sx={{ bgcolor: P.surface, borderRadius: '18px', border: `1px solid ${P.line}`, overflow: 'hidden', boxShadow }}>

            {/* Chrome bar */}
            <Box sx={{ px: '20px', py: '14px', borderBottom: `1px solid ${P.line}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                <Box key={i} sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />
              ))}
              <Box sx={{ ml: 2, flex: 1, height: 26, bgcolor: P.surface2, borderRadius: '6px', display: 'flex', alignItems: 'center', px: 1.5 }}>
                <Box sx={{ fontFamily: P.fontMono, fontSize: 11, color: P.text2 }}>paralyte.ai/studio</Box>
              </Box>
            </Box>

            {/* Prompt area */}
            <Box sx={{ px: { xs: '20px', md: '36px' }, py: '28px', borderBottom: `1px solid ${P.line}` }}>
              <Box sx={{ bgcolor: P.surface2, borderRadius: '12px', border: `1px solid ${(status === 'generating' || status === 'done') ? `rgba(${P.greenRgb},0.35)` : P.line}`, px: '20px', py: '14px', display: 'flex', alignItems: 'center', gap: 2, transition: 'border-color 0.4s' }}>
                <Box sx={{ flex: 1, fontFamily: P.fontBody, fontSize: 15, color: P.text0, minHeight: 22 }}>
                  {typed}
                  {status === 'typing' && (
                    <Box component="span" sx={{ display: 'inline-block', width: '2px', height: '1em', bgcolor: P.green, ml: '1px', verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
                  )}
                </Box>
                <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: (status === 'generating' || status === 'done') ? P.pine : `rgba(${P.greenRgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={(status === 'generating' || status === 'done') ? '#eafff7' : `rgba(${P.greenRgb},0.6)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Box>
              </Box>

              <Box sx={{ mt: 1.5, height: 18, display: 'flex', alignItems: 'center', gap: 1 }}>
                {status === 'generating' && (
                  <M initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: P.green, animation: 'pulse 1.2s ease infinite', '@keyframes pulse': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(0.7)' } } }} />
                    <Box sx={{ fontFamily: P.fontMono, fontSize: 11, color: P.green }}>Generating your learning space…</Box>
                  </M>
                )}
                {status === 'done' && (
                  <M initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Box sx={{ fontFamily: P.fontMono, fontSize: 11, color: P.text2 }}>Ready — 4 outputs generated</Box>
                  </M>
                )}
              </Box>
            </Box>

            {/* Output panels grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 0 }}>
              {PANELS.map((panel, i) => (
                <M key={panel.id} initial={{ opacity: 0, y: 20 }} animate={revealed.includes(panel.id) ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: EASE }}>
                  <Box sx={{ p: '20px', borderRight: i < PANELS.length - 1 ? `1px solid ${P.line}` : 'none', borderTop: `1px solid ${P.line}`, minHeight: 140 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: `rgba(${panel.color === P.green ? P.greenRgb : panel.color === P.cyan ? P.cyanRgb : P.violetRgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: panel.color, boxShadow: `0 0 8px ${panel.color}` }} />
                    </Box>
                    <Box sx={{ fontFamily: P.fontDisplay, fontSize: 12.5, fontWeight: 600, color: P.text0, mb: 1 }}>{panel.label}</Box>
                    <Box sx={{ height: 5, width: '75%', bgcolor: `rgba(${P.greenRgb},0.10)`, borderRadius: 2, mb: '7px' }} />
                    <Box sx={{ height: 5, width: '55%', bgcolor: `rgba(${P.greenRgb},0.07)`, borderRadius: 2 }} />
                  </Box>
                </M>
              ))}
            </Box>
          </Box>
        </M>

        {/* Replay */}
        {status === 'done' && (
          <M initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Box onClick={run} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: '18px', py: '9px', borderRadius: '100px', border: `1px solid rgba(${P.greenRgb},0.22)`, color: P.text1, fontFamily: P.fontDisplay, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.3s, color 0.3s', '&:hover': { borderColor: `rgba(${P.greenRgb},0.5)`, color: P.text0 } }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Replay demo
            </Box>
          </M>
        )}
      </Box>
    </Box>
  )
}
