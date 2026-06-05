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
const DEMO_H = 210

function DemoFrame({ children, sx }) {
  const P = useLandingTheme()
  return (
    <Box sx={{ position: 'relative', height: DEMO_H, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${P.line}`, ...sx }}>
      {children}
    </Box>
  )
}

function VideoDemo() {
  const P = useLandingTheme()
  return (
    <DemoFrame sx={{ background: 'linear-gradient(140deg, #07161c 0%, #0a2a23 58%, #07161c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Center glow */}
      <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, rgba(${P.greenRgb},0.20) 0%, transparent 58%)` }} />

      {/* Source chip */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, display: 'inline-flex', alignItems: 'center', gap: '7px', px: '11px', py: '6px', borderRadius: '100px', bgcolor: 'rgba(255,255,255,0.06)', border: `1px solid rgba(${P.greenRgb},0.3)` }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: P.green, boxShadow: `0 0 8px ${P.green}` }} />
        <Box sx={{ fontFamily: P.fontMono, fontSize: 9.5, letterSpacing: '0.14em', color: '#cfeee3' }}>AI-GENERATED</Box>
      </Box>

      {/* Play button */}
      <Box sx={{ position: 'relative', zIndex: 1, width: 64, height: 64, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)', border: `1.5px solid rgba(${P.greenRgb},0.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', boxShadow: `0 0 34px rgba(${P.greenRgb},0.3)` }}>
        <Box sx={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `15px solid ${P.green}`, ml: '4px' }} />
      </Box>

      {/* Controls */}
      <Box sx={{ position: 'absolute', left: 22, right: 22, bottom: 20 }}>
        <Box sx={{ position: 'relative', height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)' }}>
          <Box sx={{ width: '42%', height: '100%', borderRadius: 2, bgcolor: P.green, boxShadow: `0 0 8px ${P.green}` }} />
          <Box sx={{ position: 'absolute', left: '42%', top: '50%', transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', bgcolor: '#eafff7', boxShadow: `0 0 10px ${P.green}` }} />
        </Box>
        <Box sx={{ mt: '9px', display: 'flex', justifyContent: 'space-between', fontFamily: P.fontMono, fontSize: 10, color: 'rgba(207,238,227,0.7)' }}>
          <span>1:24</span><span>3:40</span>
        </Box>
      </Box>
    </DemoFrame>
  )
}

function NotesDemo() {
  const P    = useLandingTheme()
  const body = P.isDark ? 'rgba(255,255,255,0.11)' : 'rgba(10,60,38,0.11)'
  return (
    <DemoFrame sx={{ bgcolor: P.surface, display: 'flex' }}>
      {/* Accent rail */}
      <Box sx={{ width: 3, bgcolor: `rgba(${P.greenRgb},0.5)` }} />
      <Box sx={{ flex: 1, p: '24px 26px' }}>
        {/* Heading */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '11px', mb: '20px' }}>
          <Box sx={{ width: 24, height: 24, borderRadius: '7px', bgcolor: `rgba(${P.greenRgb},0.14)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: P.green }} />
          </Box>
          <Box sx={{ height: 9, width: '46%', borderRadius: 2, bgcolor: `rgba(${P.greenRgb},0.5)` }} />
        </Box>
        {/* Paragraph */}
        {[100, 90].map((w, i) => (
          <Box key={i} sx={{ height: 6, width: `${w}%`, borderRadius: 2, bgcolor: body, mb: '10px' }} />
        ))}
        {/* Sub-heading */}
        <Box sx={{ height: 7, width: '30%', borderRadius: 2, bgcolor: `rgba(${P.greenRgb},0.32)`, mt: '16px', mb: '13px' }} />
        {/* Bullets */}
        {[78, 62].map((w, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: '9px', mb: '10px' }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: `rgba(${P.greenRgb},0.55)`, flexShrink: 0 }} />
            <Box sx={{ height: 6, width: `${w}%`, borderRadius: 2, bgcolor: body }} />
          </Box>
        ))}
        {/* Tag */}
        <Box sx={{ display: 'inline-flex', mt: '15px', px: '13px', py: '6px', borderRadius: '100px', bgcolor: `rgba(${P.greenRgb},0.09)`, border: `1px solid rgba(${P.greenRgb},0.28)`, alignItems: 'center', gap: '7px' }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: P.green }} />
          <Box sx={{ height: 5, width: 42, borderRadius: 2, bgcolor: `rgba(${P.greenRgb},0.45)` }} />
        </Box>
      </Box>
    </DemoFrame>
  )
}

function ResearchDemo() {
  const P  = useLandingTheme()
  const bg = P.isDark ? 'linear-gradient(160deg, #04141a 0%, #06222a 100%)' : P.surface
  const cardFill = P.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)'
  // Source cards arranged across the top; one central synthesis node below.
  const cards = [{ x: 30, y: 26 }, { x: 138, y: 16 }, { x: 240, y: 16 }, { x: 318, y: 30 }]
  const cx = 198, cy = 150
  return (
    <DemoFrame sx={{ background: bg }}>
      <Box component="svg" viewBox="0 0 396 210" preserveAspectRatio="xMidYMid meet" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Edges: each source card → synthesis node */}
        {cards.map((c, i) => {
          const sx2 = c.x + 24, sy2 = c.y + 36, midY = (sy2 + cy) / 2
          return <path key={i} d={`M ${sx2} ${sy2} C ${sx2} ${midY}, ${cx} ${midY}, ${cx} ${cy - 18}`} fill="none" stroke={`rgba(${P.cyanRgb},0.35)`} strokeWidth="1.4" />
        })}
        {/* Synthesis glow */}
        <circle cx={cx} cy={cy} r="32" fill={`rgba(${P.cyanRgb},0.14)`} />
        {/* Source cards */}
        {cards.map((c, i) => (
          <g key={i}>
            <rect x={c.x} y={c.y} width="48" height="36" rx="7" fill={cardFill} stroke={`rgba(${P.cyanRgb},0.4)`} strokeWidth="1" />
            <rect x={c.x + 8} y={c.y + 10} width="22" height="3.4" rx="1.7" fill={`rgba(${P.cyanRgb},0.65)`} />
            <rect x={c.x + 8} y={c.y + 19} width="32" height="3" rx="1.5" fill={`rgba(${P.cyanRgb},0.3)`} />
            <rect x={c.x + 8} y={c.y + 26} width="26" height="3" rx="1.5" fill={`rgba(${P.cyanRgb},0.3)`} />
          </g>
        ))}
        {/* Synthesis node with check */}
        <circle cx={cx} cy={cy} r="18" fill={P.cyan} />
        <circle cx={cx} cy={cy} r="18" fill="none" stroke={P.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)'} strokeWidth="1.5" />
        <path d={`M ${cx - 6.5} ${cy + 0.5} l 4 4 l 8.5 -9`} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </Box>
    </DemoFrame>
  )
}

function CanvasDemo() {
  const P  = useLandingTheme()
  const bg = P.isDark ? 'linear-gradient(160deg, #04100c 0%, #061c15 100%)' : P.surface
  const ring = P.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)'
  // A tidy left-to-right knowledge tree — edges and nodes share one coordinate space.
  const nodes = [
    { x: 56,  y: 105, r: 13, c: P.green  },
    { x: 176, y: 56,  r: 10, c: P.green  },
    { x: 176, y: 154, r: 10, c: P.cyan   },
    { x: 304, y: 34,  r: 8,  c: P.cyan   },
    { x: 304, y: 94,  r: 8,  c: P.green  },
    { x: 304, y: 174, r: 8,  c: P.violet },
  ]
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]]
  const curve = (a, b) => { const mx = (a.x + b.x) / 2; return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}` }
  return (
    <DemoFrame sx={{ background: bg }}>
      <Box component="svg" viewBox="0 0 360 210" preserveAspectRatio="xMidYMid meet" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {edges.map(([a, b], i) => (
          <path key={i} d={curve(nodes[a], nodes[b])} fill="none" stroke={`rgba(${P.greenRgb},0.30)`} strokeWidth="1.5" />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.c} opacity="0.13" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} />
            <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke={ring} strokeWidth="1.2" />
          </g>
        ))}
      </Box>
    </DemoFrame>
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
          {/* A full-height sticky column that centers the list in the viewport —
              tracks the active feature without floating up over the heading
              (which a translateY(-50%) trick would do as the section enters). */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'center', position: 'sticky', top: 0, height: '100vh', alignSelf: 'start' }}>
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
