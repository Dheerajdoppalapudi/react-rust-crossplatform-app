import { useRef, useState, useEffect } from 'react'
import { Box, Typography, useTheme, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion'
import AutoAwesomeIcon       from '@mui/icons-material/AutoAwesome'
import OndemandVideoIcon     from '@mui/icons-material/OndemandVideo'
import AccountTreeIcon       from '@mui/icons-material/AccountTree'
import SpeedIcon             from '@mui/icons-material/Speed'
import PsychologyIcon        from '@mui/icons-material/Psychology'
import TuneIcon              from '@mui/icons-material/Tune'
import SchoolIcon            from '@mui/icons-material/School'
import ArrowForwardIcon      from '@mui/icons-material/ArrowForward'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'

// ─── Framer helpers ───────────────────────────────────────────────────────────
const MotionBox = motion(Box)

const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}
const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
}
const stagger = (delay = 0) => ({
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay } },
})
const scaleIn = (delay = 0) => ({
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay } },
})

// ─── Reveal wrapper — animates when it enters the viewport ───────────────────
function Reveal({ children, variants = fadeUp, threshold = 0.15, rootMargin = '0px', delay = 0, style = {} }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: threshold, margin: rootMargin })
  const v = delay
    ? { hidden: variants.hidden, visible: { ...variants.visible, transition: { ...variants.visible.transition, delay } } }
    : variants

  return (
    <MotionBox
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={v}
      style={style}
    >
      {children}
    </MotionBox>
  )
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 2 }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    let start = 0
    const steps = 60
    const inc   = target / steps
    const timer = setInterval(() => {
      start += inc
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, (duration * 1000) / steps)
    return () => clearInterval(timer)
  }, [inView, target, duration])

  return (
    <Box ref={ref} component="span">
      {count}{suffix}
    </Box>
  )
}

// ─── Feature data ─────────────────────────────────────────────────────────────
const features = [
  { icon: <OndemandVideoIcon sx={{ fontSize: 26 }} />, title: 'AI-Generated Videos',  desc: 'Any concept — from quantum physics to calculus — turned into a narrated, animated video in seconds.', color: '#4F6EFF' },
  { icon: <PsychologyIcon    sx={{ fontSize: 26 }} />, title: 'Smart Notes',           desc: 'Every session ships with structured notes and key takeaways so nothing gets lost between sessions.', color: '#7C3AED' },
  { icon: <AccountTreeIcon   sx={{ fontSize: 26 }} />, title: 'Learning Canvas',       desc: 'Visualise your full learning journey as an interactive tree. See how ideas branch and connect.', color: '#0891B2' },
  { icon: <TuneIcon          sx={{ fontSize: 26 }} />, title: 'Deep-Dive on Demand',   desc: 'Click any frame and ask a follow-up. The AI digs deeper without losing context from before.', color: '#059669' },
  { icon: <SpeedIcon         sx={{ fontSize: 26 }} />, title: 'Learn at Your Pace',    desc: 'Pause, branch into subtopics, or merge everything into one continuous review video.', color: '#DC2626' },
  { icon: <AutoAwesomeIcon   sx={{ fontSize: 26 }} />, title: 'Rich Visualisations',   desc: 'Complex ideas rendered as animations, diagrams, and step-by-step breakdowns — not just slides.', color: '#D97706' },
]

const stats = [
  { value: 10,  suffix: 'x',  label: 'Faster than reading a textbook' },
  { value: 5,   suffix: 's',  label: 'To generate a learning video' },
  { value: 100, suffix: '+',  label: 'Topics supported out of the box' },
  { value: 3,   suffix: ' modes', label: 'Chat · Learn · Canvas' },
]

const steps = [
  { step: '01', label: 'Ask anything',          sub: 'Type a topic, concept, or question you want to understand deeply — no structure needed.', color: '#4F6EFF' },
  { step: '02', label: 'Watch it come alive',   sub: 'Zenith scripts, narrates, and renders a personalised animated learning video just for you.', color: '#7C3AED' },
  { step: '03', label: 'Explore every detail',  sub: 'Dive into structured notes, key frames, and visual breakdowns at your own pace.', color: '#0891B2' },
  { step: '04', label: 'Branch deeper',         sub: 'Ask follow-ups from any frame. Spawn new sessions that branch off the exact moment you chose.', color: '#059669' },
  { step: '05', label: 'Merge & review',         sub: 'Combine your entire session tree into one continuous video to review the full picture.', color: '#D97706' },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function AboutUs() {
  const theme    = useTheme()
  const navigate = useNavigate()
  const isDark   = theme.palette.mode === 'dark'
  const accent   = theme.palette.primary.main

  // The scroll container — this element owns the scrollbar
  const scrollRef = useRef(null)

  // Mouse parallax for hero orbs
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const handleMouseMove   = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    setMouse({
      x: ((e.clientX - left) / width  - 0.5) * 2,
      y: ((e.clientY - top)  / height - 0.5) * 2,
    })
  }

  // Hero headline word-by-word animation
  const headline1 = 'Learn anything.'
  const headline2 = 'Understand everything.'

  const cardBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e8eaf0'

  return (
    <Box
      ref={scrollRef}
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        bgcolor: 'background.default',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: cardBorder, borderRadius: 2 },
      }}
    >

      {/* ════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════ */}
      <Box
        onMouseMove={handleMouseMove}
        sx={{
          position: 'relative',
          minHeight: '92vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: isDark
            ? 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(79,110,255,0.22) 0%, transparent 65%), #111111'
            : 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(0,26,255,0.10) 0%, transparent 65%), #f8fafc',
        }}
      >
        {/* Animated gradient orbs */}
        <MotionBox
          animate={{
            x: mouse.x * -28,
            y: mouse.y * -18,
          }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          sx={{
            position: 'absolute', top: '8%', right: '12%',
            width: 480, height: 480, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}28 0%, transparent 70%)`,
            filter: 'blur(60px)', pointerEvents: 'none',
          }}
        />
        <MotionBox
          animate={{
            x: mouse.x * 22,
            y: mouse.y * 14,
          }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          sx={{
            position: 'absolute', bottom: '10%', left: '8%',
            width: 380, height: 380, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)',
            filter: 'blur(55px)', pointerEvents: 'none',
          }}
        />
        <MotionBox
          animate={{
            x: mouse.x * 12,
            y: mouse.y * -10,
          }}
          transition={{ type: 'spring', stiffness: 50, damping: 16 }}
          sx={{
            position: 'absolute', top: '40%', left: '30%',
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(8,145,178,0.14) 0%, transparent 70%)',
            filter: 'blur(45px)', pointerEvents: 'none',
          }}
        />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <MotionBox
            key={i}
            animate={{
              y: [0, -18, 0],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
            sx={{
              position: 'absolute',
              width: 6 + (i % 3) * 3,
              height: 6 + (i % 3) * 3,
              borderRadius: '50%',
              background: i % 2 === 0 ? accent : '#7C3AED',
              opacity: 0.4,
              top:  `${20 + i * 12}%`,
              left: `${8  + i * 14}%`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 780, px: { xs: 3, sm: 5 } }}>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 24px ${accent}50`,
              }}>
                <SchoolIcon sx={{ fontSize: 18, color: '#fff' }} />
              </Box>
              <Chip
                label="AI-Powered Learning Platform"
                size="small"
                sx={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  bgcolor: `${accent}18`, color: accent,
                  border: `1px solid ${accent}35`, borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}
              />
            </Box>
          </motion.div>

          {/* Headline — word by word */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ overflow: 'hidden', mb: 0.5 }}>
              <motion.div
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <Typography sx={{
                  fontSize: { xs: 40, sm: 58, md: 72 },
                  fontWeight: 900, lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  color: theme.palette.text.primary,
                }}>
                  {headline1}
                </Typography>
              </motion.div>
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <motion.div
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
              >
                <Typography sx={{
                  fontSize: { xs: 40, sm: 58, md: 72 },
                  fontWeight: 900, lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 55%, #0891B2 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {headline2}
                </Typography>
              </motion.div>
            </Box>
          </Box>

          {/* Subline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
          >
            <Typography sx={{
              fontSize: { xs: 15, sm: 18 },
              color: theme.palette.text.secondary,
              lineHeight: 1.75, maxWidth: 560, mx: 'auto', mb: 4.5,
            }}>
              Zenith turns any topic into clear, animated videos with AI-generated
              explanations, structured notes, and an interactive canvas that maps
              exactly how your knowledge grows.
            </Typography>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <MotionBox
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/studio')}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  px: 3.5, py: 1.4,
                  background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
                  borderRadius: '12px', cursor: 'pointer',
                  boxShadow: `0 6px 28px ${accent}45`,
                  color: '#fff', fontSize: 14.5, fontWeight: 700,
                  userSelect: 'none',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: `0 10px 36px ${accent}60` },
                }}
              >
                Open Studio
                <ArrowForwardIcon sx={{ fontSize: 17 }} />
              </MotionBox>

              <MotionBox
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => scrollRef.current?.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  px: 3.5, py: 1.4,
                  border: `1.5px solid ${cardBorder}`,
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px', cursor: 'pointer',
                  color: theme.palette.text.primary, fontSize: 14.5, fontWeight: 600,
                  userSelect: 'none',
                }}
              >
                See how it works
              </MotionBox>
            </Box>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            style={{ marginTop: 52 }}
          >
            <MotionBox
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              sx={{
                width: 24, height: 38, border: `1.5px solid ${cardBorder}`,
                borderRadius: '12px', mx: 'auto',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                pt: '5px',
              }}
            >
              <Box sx={{ width: 3, height: 8, bgcolor: theme.palette.text.disabled, borderRadius: '2px' }} />
            </MotionBox>
          </motion.div>
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          STATS BAR
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        width: '100%',
        borderTop: `1px solid ${cardBorder}`,
        borderBottom: `1px solid ${cardBorder}`,
        bgcolor: isDark ? '#161616' : '#fff',
        py: { xs: 4, md: 5 },
        px: { xs: 2, sm: 4, md: 6 },
      }}>
        <Box sx={{
          maxWidth: 860, mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 3,
        }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{
                  fontSize: { xs: 32, md: 42 },
                  fontWeight: 900, letterSpacing: '-0.03em',
                  background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1, mb: 0.5,
                }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontWeight: 500 }}>
                  {s.label}
                </Typography>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          FEATURE CARDS
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 7, md: 10 }, px: { xs: 3, sm: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 920, mx: 'auto' }}>

          <Reveal>
            <Typography sx={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              color: theme.palette.text.disabled, textTransform: 'uppercase',
              mb: 1.5, textAlign: 'center',
            }}>
              What Zenith does
            </Typography>
          </Reveal>

          <Reveal delay={0.05}>
            <Typography sx={{
              fontSize: { xs: 28, md: 40 }, fontWeight: 900,
              letterSpacing: '-0.03em', textAlign: 'center',
              color: theme.palette.text.primary, mb: 6, lineHeight: 1.15,
            }}>
              Everything you need to<br />
              <Box component="span" sx={{
                background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                go from confused to confident.
              </Box>
            </Typography>
          </Reveal>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
          }}>
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07} variants={scaleIn(0)}>
                <MotionBox
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  sx={{
                    p: 3, borderRadius: '16px',
                    bgcolor: cardBg,
                    border: `1.5px solid ${cardBorder}`,
                    cursor: 'default',
                    position: 'relative',
                    overflow: 'hidden',
                    height: '100%',
                    '&::before': {
                      content: '""',
                      position: 'absolute', inset: 0,
                      background: `radial-gradient(circle at 0% 0%, ${f.color}18 0%, transparent 60%)`,
                      opacity: 0, transition: 'opacity 0.3s',
                    },
                    '&:hover::before': { opacity: 1 },
                    '&:hover': {
                      borderColor: `${f.color}40`,
                      boxShadow: `0 12px 40px ${f.color}20`,
                    },
                    transition: 'border-color 0.25s, box-shadow 0.25s',
                  }}
                >
                  <MotionBox
                    whileHover={{ rotate: [0, -8, 8, 0], scale: 1.12 }}
                    transition={{ duration: 0.4 }}
                    sx={{
                      width: 44, height: 44, borderRadius: '12px',
                      bgcolor: `${f.color}18`, color: f.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    {f.icon}
                  </MotionBox>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, mb: 0.75, color: theme.palette.text.primary }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.7 }}>
                    {f.desc}
                  </Typography>
                </MotionBox>
              </Reveal>
            ))}
          </Box>
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          MISSION — FULL BLEED
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        py: { xs: 8, md: 12 },
        background: isDark
          ? `linear-gradient(135deg, rgba(79,110,255,0.15) 0%, rgba(124,58,237,0.12) 50%, rgba(8,145,178,0.10) 100%)`
          : `linear-gradient(135deg, rgba(0,26,255,0.07) 0%, rgba(124,58,237,0.06) 50%, rgba(8,145,178,0.05) 100%)`,
        borderTop:    `1px solid ${isDark ? 'rgba(79,110,255,0.2)' : 'rgba(0,26,255,0.1)'}`,
        borderBottom: `1px solid ${isDark ? 'rgba(79,110,255,0.2)' : 'rgba(0,26,255,0.1)'}`,
      }}>
        {/* Decorative orb */}
        <MotionBox
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            position: 'absolute', top: '-30%', right: '-10%',
            width: 500, height: 500, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}25 0%, transparent 65%)`,
            filter: 'blur(80px)', pointerEvents: 'none',
          }}
        />

        <Box sx={{ maxWidth: 720, mx: 'auto', textAlign: 'center', px: { xs: 3, sm: 5 }, position: 'relative', zIndex: 1 }}>
          <Reveal>
            <Typography sx={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              color: accent, mb: 2.5, textTransform: 'uppercase',
            }}>
              Our Mission
            </Typography>
          </Reveal>
          <Reveal delay={0.1}>
            <Typography sx={{
              fontSize: { xs: 22, md: 34 }, fontWeight: 800,
              lineHeight: 1.4, letterSpacing: '-0.02em',
              color: theme.palette.text.primary,
            }}>
              "Make the hardest concepts in the world accessible to anyone —
              through AI-generated video, structured notes, and a canvas that
              maps how knowledge grows."
            </Typography>
          </Reveal>
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          HOW IT WORKS — animated timeline
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 7, md: 10 }, px: { xs: 3, sm: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>

          <Reveal>
            <Typography sx={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              color: theme.palette.text.disabled, textTransform: 'uppercase',
              mb: 1.5, textAlign: 'center',
            }}>
              How it works
            </Typography>
          </Reveal>
          <Reveal delay={0.05}>
            <Typography sx={{
              fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: '-0.03em',
              textAlign: 'center', color: theme.palette.text.primary, mb: 7, lineHeight: 1.15,
            }}>
              Five steps to<br />
              <Box component="span" sx={{
                background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                understanding anything.
              </Box>
            </Typography>
          </Reveal>

          {steps.map((item, i) => (
            <Reveal key={item.step} delay={i * 0.1}>
              <Box sx={{ display: 'flex', gap: 3, mb: i < steps.length - 1 ? 0 : 0 }}>
                {/* Line + dot column */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <MotionBox
                    whileInView={{ scale: [0.5, 1.15, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, ease: 'backOut', delay: i * 0.1 + 0.2 }}
                    sx={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${item.color}35 0%, ${item.color}18 100%)`,
                      border: `2px solid ${item.color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 0 0 6px ${item.color}10`,
                    }}
                  >
                    <Typography sx={{ fontSize: 10, fontWeight: 900, color: item.color }}>
                      {item.step}
                    </Typography>
                  </MotionBox>
                  {i < steps.length - 1 && (
                    <Box sx={{
                      width: 2, flex: 1, minHeight: 40, my: 0.75,
                      background: `linear-gradient(to bottom, ${item.color}50, ${steps[i + 1].color}30)`,
                      borderRadius: 1,
                    }} />
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ pb: i < steps.length - 1 ? 4 : 0, pt: 0.5 }}>
                  <Typography sx={{
                    fontSize: 16, fontWeight: 800, color: theme.palette.text.primary,
                    mb: 0.6, letterSpacing: '-0.01em',
                  }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.7 }}>
                    {item.sub}
                  </Typography>
                </Box>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          CONVERSATION DEMO
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 6, md: 9 }, px: { xs: 3, sm: 5, md: 8 },
        bgcolor: isDark ? '#161616' : '#fff',
        borderTop: `1px solid ${cardBorder}`,
        borderBottom: `1px solid ${cardBorder}`,
      }}>
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Reveal>
            <Typography sx={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              color: theme.palette.text.disabled, textTransform: 'uppercase',
              mb: 1.5, textAlign: 'center',
            }}>
              See it in action
            </Typography>
          </Reveal>
          <Reveal delay={0.06}>
            <Typography sx={{
              fontSize: { xs: 26, md: 36 }, fontWeight: 900, letterSpacing: '-0.03em',
              textAlign: 'center', color: theme.palette.text.primary, mb: 6, lineHeight: 1.15,
            }}>
              A real Zenith conversation<br />
              <Box component="span" sx={{
                background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                looks like this.
              </Box>
            </Typography>
          </Reveal>

          {/* Glassmorphism chat window */}
          <Reveal variants={scaleIn(0)}>
            <Box sx={{
              borderRadius: '20px',
              border: `1.5px solid ${cardBorder}`,
              overflow: 'hidden',
              boxShadow: isDark
                ? '0 24px 80px rgba(0,0,0,0.5)'
                : '0 24px 80px rgba(0,0,0,0.1)',
            }}>
              {/* Window chrome */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2.5, py: 1.5,
                bgcolor: isDark ? '#1e1e1e' : '#f5f5f7',
                borderBottom: `1px solid ${cardBorder}`,
              }}>
                {['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => (
                  <Box key={i} sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: c }} />
                ))}
                <Box sx={{
                  mx: 'auto', px: 3, py: 0.4, borderRadius: '6px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 0.75,
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28C840' }} />
                  <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary }}>
                    zenith.app — Studio
                  </Typography>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.default' }}>
                {[
                  { role: 'user', text: 'Explain how neural networks learn through backpropagation', delay: 0.1 },
                  { role: 'ai',   text: 'Generating a visual breakdown of backpropagation with gradient descent animations...', generating: true, delay: 0.3 },
                  { role: 'user', text: 'Go deeper on the vanishing gradient problem — show me frame 3', delay: 0.55 },
                  { role: 'ai',   text: 'Branching from frame 3 — creating a focused deep-dive on gradient flow through deep layers...', generating: true, delay: 0.75 },
                ].map((msg, i) => (
                  <Reveal key={i} delay={msg.delay} variants={fadeIn}>
                    <Box sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 1.25 }}>
                      {msg.role === 'ai' && (
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '8px', flexShrink: 0, mt: 0.25,
                          background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 4px 12px ${accent}40`,
                        }}>
                          <AutoAwesomeIcon sx={{ fontSize: 13, color: '#fff' }} />
                        </Box>
                      )}
                      <Box sx={{
                        maxWidth: '60%', px: 2, py: 1.25,
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        bgcolor: msg.role === 'user'
                          ? (isDark ? '#242424' : '#f1f5f9')
                          : (isDark ? `${accent}14` : `${accent}08`),
                        border: `1px solid ${msg.role === 'user'
                          ? (isDark ? '#2e2e2e' : '#e2e8f0')
                          : (isDark ? `${accent}25` : `${accent}18`)}`,
                      }}>
                        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, lineHeight: 1.55 }}>
                          {msg.text}
                        </Typography>
                        {msg.generating && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                            {[0, 0.18, 0.36].map((d, idx) => (
                              <MotionBox
                                key={idx}
                                animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: d, ease: 'easeInOut' }}
                                sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: accent }}
                              />
                            ))}
                            <Typography sx={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                              Generating…
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Reveal>
                ))}

                {/* Video card preview */}
                <Reveal delay={0.9} variants={scaleIn(0)}>
                  <MotionBox
                    whileHover={{ scale: 1.015, y: -3 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                    sx={{
                      ml: 5, p: 2, borderRadius: '14px',
                      background: isDark
                        ? `linear-gradient(135deg, ${accent}14 0%, rgba(124,58,237,0.1) 100%)`
                        : `linear-gradient(135deg, ${accent}08 0%, rgba(124,58,237,0.05) 100%)`,
                      border: `1.5px solid ${isDark ? `${accent}25` : `${accent}18`}`,
                      display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer',
                    }}
                  >
                    <Box sx={{
                      width: 52, height: 52, borderRadius: '10px',
                      bgcolor: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PlayCircleOutlineIcon sx={{ fontSize: 28, color: accent }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: theme.palette.text.primary, mb: 0.3 }}>
                        Backpropagation: Vanishing Gradients
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary }}>
                        Video ready · 12 frames · Notes included
                      </Typography>
                    </Box>
                  </MotionBox>
                </Reveal>
              </Box>
            </Box>
          </Reveal>
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          SIDEBAR CALLOUT
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 6, md: 9 }, px: { xs: 3, sm: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Reveal variants={scaleIn(0)}>
            <MotionBox
              whileHover={{ scale: 1.008 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              sx={{
                display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' }, gap: 3,
                p: { xs: 3, sm: 4 }, borderRadius: '20px',
                background: isDark
                  ? `linear-gradient(135deg, rgba(79,110,255,0.12) 0%, rgba(124,58,237,0.08) 100%)`
                  : `linear-gradient(135deg, rgba(0,26,255,0.06) 0%, rgba(124,58,237,0.04) 100%)`,
                border: `1.5px solid ${isDark ? 'rgba(79,110,255,0.2)' : 'rgba(0,26,255,0.12)'}`,
                boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.3)' : '0 16px 48px rgba(0,0,0,0.06)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <Box sx={{
                position: 'absolute', top: -40, right: -40,
                width: 180, height: 180, borderRadius: '50%',
                background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
                filter: 'blur(30px)', pointerEvents: 'none',
              }} />
              <Box sx={{
                width: 56, height: 56, borderRadius: '16px', flexShrink: 0,
                bgcolor: `${accent}18`, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${accent}30`,
              }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 800, color: theme.palette.text.primary, mb: 0.5, letterSpacing: '-0.01em' }}>
                  All your chats, always in the sidebar.
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.65 }}>
                  Every session is saved and searchable — just like ChatGPT or Claude. Pick up where you left off,
                  or branch a new conversation from any previous frame.
                </Typography>
              </Box>
              <MotionBox
                whileHover={{ scale: 1.05, x: 2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/studio')}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  px: 2.5, py: 1.1, borderRadius: '10px', cursor: 'pointer',
                  border: `1.5px solid ${accent}40`, color: accent,
                  fontSize: 13.5, fontWeight: 700, flexShrink: 0, userSelect: 'none',
                  bgcolor: `${accent}0d`,
                  '&:hover': { bgcolor: `${accent}18` },
                  transition: 'background 0.2s',
                }}
              >
                Start learning
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </MotionBox>
            </MotionBox>
          </Reveal>
        </Box>
      </Box>


      {/* ════════════════════════════════════════════════════════════════════
          FOOTER NOTE
      ════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: 3.5, textAlign: 'center',
        borderTop: `1px solid ${cardBorder}`,
        px: 3,
      }}>
        <Reveal variants={fadeIn}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 22, height: 22, borderRadius: '6px',
              background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoAwesomeIcon sx={{ fontSize: 11, color: '#fff' }} />
            </Box>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
              Built with the belief that understanding should never be a barrier to learning.
            </Typography>
          </Box>
        </Reveal>
      </Box>

    </Box>
  )
}
