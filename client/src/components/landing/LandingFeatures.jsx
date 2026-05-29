import { useRef, useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { motion, useInView } from 'framer-motion'
import { useLandingTheme } from './tokens.js'
import { EyebrowLabel } from './LandingProblem.jsx'

const M = motion(Box)
const EASE = [0.16, 1, 0.3, 1]

const FEATURES = [
  {
    id:    'video',
    num:   '01',
    tag:   '01 — Generated',
    title: 'AI Video',
    h3:    'An animated explainer, made for your question.',
    body:  'Paralyte directs a narrated, motion-designed video that builds the concept up visually — pausing, zooming, and re-drawing exactly where understanding usually breaks.',
  },
  {
    id:    'notes',
    num:   '02',
    tag:   '02 — Structured',
    title: 'Structured Notes',
    h3:    'Notes that hold their shape.',
    body:  'Every explainer is mirrored as clean, hierarchical notes — definitions, intuition, worked steps, and edge cases — so you can revisit the idea without re-watching a thing.',
  },
  {
    id:    'research',
    num:   '03',
    tag:   '03 — Cited',
    title: 'Research Synthesis',
    h3:    'Research synthesis you can trust.',
    body:  'Paralyte reads across sources, reconciles what they actually say, and hands you a synthesis with every claim traceable to its origin. No hallucinated confidence.',
  },
  {
    id:    'canvas',
    num:   '04',
    tag:   '04 — Connected',
    title: 'Interactive Canvas',
    h3:    'A canvas that maps how knowledge grows.',
    body:  'Each topic becomes a living node. Branch into prerequisites, spin off tangents, and watch your understanding assemble into a graph you can actually navigate.',
  },
]

// ─── Visual demos ─────────────────────────────────────────────────────────────
function VideoDemo() {
  const P = useLandingTheme()
  const bg = P.isDark ? '#040c10' : '#e8f2ee'
  return (
    <Box sx={{ position: 'relative', height: 200, bgcolor: bg, borderRadius: '14px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%, rgba(${P.greenRgb},0.13) 0%, transparent 68%)` }} />
      <Box sx={{ width: 54, height: 54, borderRadius: '50%', border: `1.5px solid rgba(${P.greenRgb},0.55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <Box sx={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `16px solid rgba(${P.greenRgb},0.75)`, ml: '3px' }} />
      </Box>
      <Box sx={{ position: 'absolute', bottom: 20, left: 24, right: 24, height: 3, bgcolor: `rgba(${P.greenRgb},0.12)`, borderRadius: 2 }}>
        <Box sx={{ width: '38%', height: '100%', bgcolor: P.green, borderRadius: 2, boxShadow: `0 0 6px ${P.green}` }} />
        <Box sx={{ position: 'absolute', right: '62%', top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', bgcolor: P.green, boxShadow: `0 0 8px ${P.green}` }} />
      </Box>
    </Box>
  )
}

function NotesDemo() {
  const P = useLandingTheme()
  return (
    <Box sx={{ height: 200, bgcolor: P.surface, borderRadius: '14px', p: '24px', overflow: 'hidden' }}>
      <Box sx={{ height: 10, width: '58%', bgcolor: `rgba(${P.greenRgb},0.55)`, borderRadius: 2, mb: '20px' }} />
      {[[100, 0], [90, 0], [72, 20], [90, 20], [55, 20]].map(([w, indent], i) => (
        <Box key={i} sx={{ height: 6, width: `${w}%`, ml: `${indent}px`, bgcolor: `rgba(${P.greenRgb},0.14)`, borderRadius: 2, mb: '10px' }} />
      ))}
      <Box sx={{ display: 'inline-flex', mt: 1, px: 1.5, py: '5px', borderRadius: '100px', bgcolor: `rgba(${P.greenRgb},0.09)`, border: `1px solid rgba(${P.greenRgb},0.28)`, gap: 1 }}>
        <Box sx={{ height: 6, width: 44, bgcolor: `rgba(${P.greenRgb},0.45)`, borderRadius: 2, alignSelf: 'center' }} />
      </Box>
    </Box>
  )
}

function ResearchDemo() {
  const P = useLandingTheme()
  const bg = P.isDark ? '#040e12' : '#e4f0ea'
  const lines = [
    { x1: 50, y1: 50, x2: 18, y2: 22 }, { x1: 50, y1: 50, x2: 82, y2: 26 },
    { x1: 50, y1: 50, x2: 20, y2: 78 }, { x1: 50, y1: 50, x2: 80, y2: 74 },
  ]
  const satellites = [
    { left: '14%', top: '16%' }, { right: '13%', top: '20%' },
    { left: '16%', bottom: '16%' }, { right: '14%', bottom: '16%' },
  ]
  return (
    <Box sx={{ position: 'relative', height: 200, bgcolor: bg, borderRadius: '14px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%, rgba(${P.cyanRgb},0.10) 0%, transparent 68%)` }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((l, i) => (
          <line key={i} x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`} stroke={`rgba(${P.cyanRgb},0.3)`} strokeWidth="0.8" />
        ))}
      </svg>
      <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: P.cyan, boxShadow: `0 0 24px rgba(${P.cyanRgb},0.5)`, zIndex: 1 }} />
      {satellites.map((pos, i) => (
        <Box key={i} sx={{ position: 'absolute', width: 11, height: 11, borderRadius: '50%', border: `1.5px solid rgba(${P.cyanRgb},0.45)`, bgcolor: `rgba(${P.cyanRgb},0.1)`, ...pos }} />
      ))}
    </Box>
  )
}

function CanvasDemo() {
  const P = useLandingTheme()
  const bg = P.isDark ? '#040a0c' : '#e6f0ea'
  const edges = [
    [200, 90, 80, 42], [200, 90, 326, 48], [200, 90, 96, 148], [200, 90, 308, 140], [326, 48, 308, 140],
  ]
  const nodes = [
    { x: '49%', y: '49%', color: P.green },
    { x: '19%', y: '22%', color: P.green },
    { x: '80%', y: '25%', color: P.cyan },
    { x: '23%', y: '78%', color: P.green },
    { x: '75%', y: '74%', color: P.violet },
  ]
  return (
    <Box sx={{ position: 'relative', height: 200, bgcolor: bg, borderRadius: '14px', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 400 180" preserveAspectRatio="none">
        <g stroke={`rgba(${P.greenRgb},0.32)`} strokeWidth="1.2">
          {edges.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
        </g>
      </svg>
      {nodes.map(({ x, y, color }, i) => (
        <Box key={i} sx={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 12px ${color}` }} />
      ))}
    </Box>
  )
}

const DEMOS = { video: <VideoDemo />, notes: <NotesDemo />, research: <ResearchDemo />, canvas: <CanvasDemo /> }

// ─── Feature article ──────────────────────────────────────────────────────────
function FeatureArticle({ feature, id }) {
  const P      = useLandingTheme()
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.25 })
  return (
    <Box ref={ref} id={id} component="article" sx={{ mb: { xs: 8, md: 12 } }}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.75, ease: EASE }}
      >
        <Box sx={{ fontFamily: P.fontMono, fontSize: 11, color: P.text2, letterSpacing: '0.12em', mb: 1.5 }}>{feature.tag}</Box>
        <Box component="h3" sx={{ fontFamily: P.fontDisplay, fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.15, color: P.text0, mb: 1.5, mt: 0 }}>
          {feature.h3}
        </Box>
        <Box component="p" sx={{ fontFamily: P.fontBody, fontSize: 16, color: P.text1, lineHeight: 1.75, mb: 3, mt: 0, maxWidth: 520 }}>
          {feature.body}
        </Box>
        {DEMOS[feature.id]}
      </motion.div>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingFeatures() {
  const P          = useLandingTheme()
  const [active, setActive] = useState('video')
  const headRef    = useRef(null)
  const headInView = useInView(headRef, { once: true, amount: 0.4 })

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.dataset.fid)
        }
      },
      { threshold: 0.45 }
    )
    for (const f of FEATURES) {
      const el = document.getElementById(`feat-${f.id}`)
      if (el) { el.dataset.fid = f.id; obs.observe(el) }
    }
    return () => obs.disconnect()
  }, [])

  const scrollTo = id => {
    document.getElementById(`feat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <Box component="section" sx={{ bgcolor: P.bg1, borderTop: `1px solid ${P.line}`, py: { xs: '80px', md: '140px' } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: '5%', md: '6%' } }}>

        {/* Head */}
        <Box ref={headRef} sx={{ mb: { xs: 6, md: 9 }, maxWidth: 640 }}>
          <Box sx={{ mb: 2 }}><EyebrowLabel>How Paralyte works</EyebrowLabel></Box>
          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={headInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
            style={{ fontFamily: P.fontDisplay, fontSize: 'clamp(28px, 4.5vw, 54px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, color: P.text0, margin: '0 0 18px' }}
          >
            One question becomes four ways to understand it.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={headInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: EASE, delay: 0.10 }}
            style={{ fontFamily: P.fontBody, fontSize: 17, color: P.text1, lineHeight: 1.7, margin: 0 }}
          >
            Paralyte doesn&apos;t return links. It reasons about your topic and produces a complete learning space — generated, cited, and connected.
          </motion.p>
        </Box>

        {/* Body — sticky nav + panels */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: { xs: 0, md: 8 }, alignItems: 'start' }}>

          {/* Sticky nav */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 40, alignSelf: 'flex-start' }}>
            {FEATURES.map(f => (
              <Box
                key={f.id}
                onClick={() => scrollTo(f.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  py: '14px', px: '16px', cursor: 'pointer',
                  borderLeft: `2px solid ${active === f.id ? P.green : P.lineStrong}`,
                  transition: 'border-color 0.3s',
                  '&:hover': { borderColor: `rgba(${P.greenRgb},0.5)` },
                }}
              >
                <Box sx={{ fontFamily: P.fontMono, fontSize: 10.5, fontWeight: 500, color: active === f.id ? P.green : P.text2, transition: 'color 0.3s' }}>
                  {f.num}
                </Box>
                <Box sx={{ fontFamily: P.fontDisplay, fontSize: 13.5, fontWeight: active === f.id ? 600 : 400, color: active === f.id ? P.text0 : P.text2, transition: 'color 0.3s, font-weight 0.3s' }}>
                  {f.title}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Feature panels */}
          <Box>
            {FEATURES.map(f => (
              <FeatureArticle key={f.id} feature={f} id={`feat-${f.id}`} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
