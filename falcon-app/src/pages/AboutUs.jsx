import { Box, Typography, useTheme, Chip } from '@mui/material'
import AutoAwesomeIcon        from '@mui/icons-material/AutoAwesome'
import OndemandVideoIcon      from '@mui/icons-material/OndemandVideo'
import AccountTreeIcon        from '@mui/icons-material/AccountTree'
import SpeedIcon              from '@mui/icons-material/Speed'
import PsychologyIcon         from '@mui/icons-material/Psychology'
import TuneIcon               from '@mui/icons-material/Tune'
import SchoolIcon             from '@mui/icons-material/School'

const features = [
  {
    icon: <OndemandVideoIcon sx={{ fontSize: 22 }} />,
    title: 'AI-Generated Videos',
    desc:  'Any concept — from quantum physics to calculus — turned into a clean, narrated video in seconds.',
  },
  {
    icon: <PsychologyIcon sx={{ fontSize: 22 }} />,
    title: 'Smart Explanations & Notes',
    desc:  'Every video comes with structured notes and key takeaways so nothing gets lost.',
  },
  {
    icon: <AccountTreeIcon sx={{ fontSize: 22 }} />,
    title: 'Learning Canvas',
    desc:  'Visualise your entire learning journey as an interactive tree. See how ideas connect and branch.',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 22 }} />,
    title: 'Go Deeper on Demand',
    desc:  'Click any frame or concept and ask a follow-up. The AI digs deeper without losing context.',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 22 }} />,
    title: 'Learn at Your Own Pace',
    desc:  'Pause, rewind, branch into sub-topics, or merge everything into one consolidated video.',
  },
  {
    icon: <AutoAwesomeIcon sx={{ fontSize: 22 }} />,
    title: 'Rich Visualisations',
    desc:  'Complex ideas rendered as animations, diagrams, and step-by-step breakdowns — not just slides.',
  },
]

export default function AboutUs() {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const cardBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e8eaf0'
  const accent     = theme.palette.primary.main

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, sm: 4 }, py: 5 }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px',
            bgcolor: `${accent}20`,
            border:  `1px solid ${accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SchoolIcon sx={{ fontSize: 20, color: accent }} />
          </Box>
          <Chip
            label="AI-Powered Learning"
            size="small"
            sx={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
              bgcolor: `${accent}15`, color: accent,
              border: `1px solid ${accent}30`,
              borderRadius: '6px',
            }}
          />
        </Box>

        <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2, mb: 2, letterSpacing: '-0.02em' }}>
          Learn anything.<br />
          <Box component="span" sx={{ color: accent }}>Understand everything.</Box>
        </Typography>

        <Typography sx={{ fontSize: 15, color: theme.palette.text.secondary, lineHeight: 1.8, maxWidth: 580 }}>
          Falcon turns any topic — no matter how complex — into clear, engaging videos with
          explanations, notes, and visualisations. Built for curious minds who want to go deep
          without getting lost.
        </Typography>
      </Box>

      {/* ── Mission card ──────────────────────────────────────────────────────── */}
      <Box sx={{
        p: 3, mb: 5, borderRadius: '14px',
        background: isDark
          ? `linear-gradient(135deg, ${accent}18 0%, transparent 60%)`
          : `linear-gradient(135deg, ${accent}10 0%, transparent 60%)`,
        border: `1px solid ${accent}25`,
      }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: accent, mb: 1 }}>
          OUR MISSION
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: theme.palette.text.primary }}>
          "Make the hardest concepts in the world accessible to anyone, anywhere — through the
          power of AI-generated video, structured notes, and an interactive canvas that maps
          how knowledge grows."
        </Typography>
      </Box>

      {/* ── Features grid ─────────────────────────────────────────────────────── */}
      <Typography sx={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: theme.palette.text.secondary, mb: 2.5,
      }}>
        WHAT FALCON DOES
      </Typography>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1.5, mb: 6,
      }}>
        {features.map((f) => (
          <Box key={f.title} sx={{
            p: 2.5, borderRadius: '12px',
            bgcolor: cardBg,
            border: `1px solid ${cardBorder}`,
            transition: 'border-color 0.2s, background 0.2s',
            '&:hover': {
              borderColor: `${accent}50`,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
            },
          }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '8px',
              bgcolor: `${accent}15`, color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 1.5,
            }}>
              {f.icon}
            </Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
              {f.title}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.65 }}>
              {f.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <Typography sx={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: theme.palette.text.secondary, mb: 2.5,
      }}>
        HOW IT WORKS
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[
          { step: '01', label: 'Enter a topic or question',     sub: 'Type anything — a concept, a question, or a subject you\'re studying.' },
          { step: '02', label: 'Falcon generates your video',   sub: 'The AI plans, scripts, and renders a personalised learning video with narration.' },
          { step: '03', label: 'Explore notes & frames',        sub: 'Dive into structured notes, key frames, and visual breakdowns at your own pace.' },
          { step: '04', label: 'Branch into deeper topics',     sub: 'Ask follow-ups, go deeper on any frame, and build your own learning tree.' },
          { step: '05', label: 'Merge & review',                sub: 'Combine your entire session into one continuous video to review the full picture.' },
        ].map((item, i, arr) => (
          <Box key={item.step} sx={{ display: 'flex', gap: 2.5 }}>
            {/* Stepper line */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%',
                bgcolor: `${accent}20`, border: `1.5px solid ${accent}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: accent }}>{item.step}</Typography>
              </Box>
              {i < arr.length - 1 && (
                <Box sx={{ width: 1.5, flex: 1, minHeight: 24, bgcolor: cardBorder, my: 0.5 }} />
              )}
            </Box>
            {/* Content */}
            <Box sx={{ pb: i < arr.length - 1 ? 2.5 : 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary, mb: 0.4 }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.6 }}>
                {item.sub}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Footer note ───────────────────────────────────────────────────────── */}
      <Box sx={{
        mt: 6, pt: 3, borderTop: `1px solid ${cardBorder}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <AutoAwesomeIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
        <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled }}>
          Built with the belief that understanding should never be a barrier to learning.
        </Typography>
      </Box>

    </Box>
  )
}
