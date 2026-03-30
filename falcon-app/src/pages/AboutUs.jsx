import { useState } from 'react'
import { Box, Typography, useTheme, Chip, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import OndemandVideoIcon  from '@mui/icons-material/OndemandVideo'
import AccountTreeIcon    from '@mui/icons-material/AccountTree'
import SpeedIcon          from '@mui/icons-material/Speed'
import PsychologyIcon     from '@mui/icons-material/Psychology'
import TuneIcon           from '@mui/icons-material/Tune'
import SchoolIcon         from '@mui/icons-material/School'
import ArrowForwardIcon   from '@mui/icons-material/ArrowForward'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

const features = [
  {
    icon: <OndemandVideoIcon sx={{ fontSize: 24 }} />,
    title: 'AI-Generated Videos',
    desc: 'Any concept — from quantum physics to calculus — turned into a clean, narrated video in seconds.',
    color: '#4F6EFF',
  },
  {
    icon: <PsychologyIcon sx={{ fontSize: 24 }} />,
    title: 'Smart Notes',
    desc: 'Every video comes with structured notes and key takeaways so nothing gets lost.',
    color: '#7C3AED',
  },
  {
    icon: <AccountTreeIcon sx={{ fontSize: 24 }} />,
    title: 'Learning Canvas',
    desc: 'Visualise your entire learning journey as an interactive tree. See how ideas connect.',
    color: '#0891B2',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 24 }} />,
    title: 'Deep Dives',
    desc: 'Click any frame and ask a follow-up. The AI digs deeper without losing context.',
    color: '#059669',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 24 }} />,
    title: 'Learn at Your Pace',
    desc: 'Pause, rewind, branch into sub-topics, or merge everything into one video.',
    color: '#DC2626',
  },
  {
    icon: <AutoAwesomeIcon sx={{ fontSize: 24 }} />,
    title: 'Rich Visualisations',
    desc: 'Complex ideas rendered as animations, diagrams, and step-by-step breakdowns.',
    color: '#D97706',
  },
]

const steps = [
  { step: '01', label: 'Ask anything',          sub: 'Type a topic, question, or concept you want to understand deeply.' },
  { step: '02', label: 'Watch it come alive',   sub: 'Falcon scripts, narrates, and renders a personalised learning video.' },
  { step: '03', label: 'Explore every detail',  sub: 'Dive into structured notes, key frames, and visual breakdowns.' },
  { step: '04', label: 'Go deeper on demand',   sub: 'Ask follow-ups from any frame — branch into subtopics instantly.' },
  { step: '05', label: 'Merge and review',       sub: 'Combine your session into one continuous video to review the full picture.' },
]

// Simulated conversation for the demo panel
const demoMessages = [
  { role: 'user', text: 'Explain how neural networks learn' },
  { role: 'ai',   text: 'Generating a visual breakdown of backpropagation with gradient descent...', generating: true },
  { role: 'user', text: 'Now go deeper on the vanishing gradient problem' },
  { role: 'ai',   text: 'Branching from frame 3 — creating a focused deep-dive on gradient flow...', generating: true },
]

export default function AboutUs() {
  const theme   = useTheme()
  const navigate = useNavigate()
  const isDark  = theme.palette.mode === 'dark'
  const accent  = theme.palette.primary.main

  const [activeFeature, setActiveFeature] = useState(0)

  const cardBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e8eaf0'

  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative',
        width: '100%',
        minHeight: 480,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: isDark
          ? `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}18 0%, transparent 70%), #111111`
          : `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}12 0%, transparent 70%), #f8fafc`,
      }}>
        {/* Decorative blobs */}
        <Box sx={{
          position: 'absolute', top: -80, right: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: isDark ? `${accent}10` : `${accent}08`,
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -60, left: -60,
          width: 300, height: 300, borderRadius: '50%',
          background: isDark ? '#7C3AED15' : '#7C3AED08',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        <Box sx={{
          position: 'relative', zIndex: 1,
          maxWidth: 820, mx: 'auto', px: { xs: 3, sm: 6, md: 8 },
          py: { xs: 6, md: 8 },
          width: '100%',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px ${accent}40`,
            }}>
              <SchoolIcon sx={{ fontSize: 22, color: '#fff' }} />
            </Box>
            <Chip
              label="AI-Powered Learning"
              size="small"
              sx={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                bgcolor: `${accent}15`, color: accent,
                border: `1px solid ${accent}30`, borderRadius: '6px',
              }}
            />
          </Box>

          <Typography sx={{
            fontSize: { xs: 36, md: 52 },
            fontWeight: 900, lineHeight: 1.1,
            letterSpacing: '-0.03em', mb: 2.5,
            color: theme.palette.text.primary,
          }}>
            Learn anything.<br />
            <Box component="span" sx={{
              background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Understand everything.
            </Box>
          </Typography>

          <Typography sx={{
            fontSize: { xs: 15, md: 17 },
            color: theme.palette.text.secondary,
            lineHeight: 1.75, maxWidth: 540, mb: 4,
          }}>
            Falcon turns any topic into clear, engaging videos with AI-generated
            explanations, interactive notes, and a visual canvas that maps how
            your knowledge grows.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/studio')}
              sx={{
                borderRadius: '10px', px: 3, py: 1.1,
                fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
                boxShadow: `0 4px 16px ${accent}40`,
                textTransform: 'none',
                '&:hover': { boxShadow: `0 6px 24px ${accent}55` },
              }}
            >
              Open Studio
            </Button>
            <Button
              variant="outlined"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{
                borderRadius: '10px', px: 3, py: 1.1,
                fontSize: 14, fontWeight: 600,
                borderColor: cardBorder, color: theme.palette.text.primary,
                textTransform: 'none',
                '&:hover': { borderColor: accent, color: accent, bgcolor: `${accent}08` },
              }}
            >
              See how it works
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Conversation demo strip ───────────────────────────────────────────── */}
      <Box sx={{
        width: '100%',
        bgcolor: isDark ? '#161616' : '#fff',
        borderTop: `1px solid ${cardBorder}`,
        borderBottom: `1px solid ${cardBorder}`,
        py: { xs: 4, md: 5 },
        px: { xs: 3, sm: 6, md: 10 },
      }}>
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: theme.palette.text.secondary, mb: 3, textTransform: 'uppercase',
          }}>
            How conversations look
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {demoMessages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role === 'ai' && (
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mr: 1.25, mt: 0.25,
                  }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14, color: '#fff' }} />
                  </Box>
                )}
                <Box sx={{
                  maxWidth: '65%',
                  px: 2, py: 1.25,
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  bgcolor: msg.role === 'user'
                    ? (isDark ? '#242424' : '#f1f5f9')
                    : (isDark ? 'rgba(79,110,255,0.1)' : 'rgba(0,26,255,0.05)'),
                  border: `1px solid ${msg.role === 'user'
                    ? (isDark ? '#2e2e2e' : '#e2e8f0')
                    : (isDark ? 'rgba(79,110,255,0.2)' : 'rgba(0,26,255,0.1)')}`,
                }}>
                  <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, lineHeight: 1.55 }}>
                    {msg.text}
                  </Typography>
                  {msg.generating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                      {[0, 0.15, 0.3].map((delay, idx) => (
                        <Box key={idx} sx={{
                          width: 5, height: 5, borderRadius: '50%', bgcolor: accent,
                          animation: 'pulse 1.4s ease-in-out infinite',
                          animationDelay: `${delay}s`,
                          '@keyframes pulse': {
                            '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.85)' },
                            '40%': { opacity: 1, transform: 'scale(1.1)' },
                          },
                        }} />
                      ))}
                      <Typography sx={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                        Generating…
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{
            mt: 3, p: 2, borderRadius: '12px',
            bgcolor: cardBg, border: `1px solid ${cardBorder}`,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <PlayCircleOutlineIcon sx={{ color: accent, fontSize: 28, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: theme.palette.text.primary }}>
                Each reply becomes an interactive video
              </Typography>
              <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mt: 0.3 }}>
                With frames, captions, and structured notes — all saved to your conversation history in the sidebar.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <Box sx={{
        width: '100%',
        py: { xs: 5, md: 7 },
        px: { xs: 3, sm: 6, md: 10 },
      }}>
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: theme.palette.text.secondary, mb: 3, textTransform: 'uppercase',
          }}>
            What Falcon does
          </Typography>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}>
            {features.map((f, i) => (
              <Box
                key={f.title}
                onClick={() => setActiveFeature(i)}
                sx={{
                  p: 2.5, borderRadius: '14px',
                  bgcolor: activeFeature === i
                    ? (isDark ? `${f.color}18` : `${f.color}0e`)
                    : cardBg,
                  border: `1.5px solid ${activeFeature === i ? `${f.color}50` : cardBorder}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: activeFeature === i ? 'translateY(-2px)' : 'none',
                  boxShadow: activeFeature === i
                    ? `0 8px 24px ${f.color}20`
                    : 'none',
                  '&:hover': {
                    borderColor: `${f.color}40`,
                    bgcolor: isDark ? `${f.color}10` : `${f.color}08`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{
                  width: 38, height: 38, borderRadius: '10px',
                  bgcolor: `${f.color}18`, color: f.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mb: 1.5,
                  transition: 'transform 0.2s',
                  transform: activeFeature === i ? 'scale(1.1)' : 'scale(1)',
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
        </Box>
      </Box>

      {/* ── Mission band ─────────────────────────────────────────────────────── */}
      <Box sx={{
        width: '100%',
        background: isDark
          ? `linear-gradient(135deg, ${accent}18 0%, #7C3AED18 100%)`
          : `linear-gradient(135deg, ${accent}0e 0%, #7C3AED0a 100%)`,
        borderTop: `1px solid ${isDark ? `${accent}25` : `${accent}18`}`,
        borderBottom: `1px solid ${isDark ? `${accent}25` : `${accent}18`}`,
        py: { xs: 5, md: 6 },
        px: { xs: 3, sm: 6, md: 10 },
      }}>
        <Box sx={{ maxWidth: 680, mx: 'auto', textAlign: 'center' }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: accent, mb: 2, textTransform: 'uppercase',
          }}>
            Our Mission
          </Typography>
          <Typography sx={{
            fontSize: { xs: 20, md: 26 },
            fontWeight: 700, lineHeight: 1.45,
            color: theme.palette.text.primary,
            letterSpacing: '-0.01em',
          }}>
            "Make the hardest concepts in the world accessible to anyone —
            through AI-generated video, structured notes, and a canvas that
            maps how knowledge grows."
          </Typography>
        </Box>
      </Box>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <Box
        id="how-it-works"
        sx={{
          width: '100%',
          py: { xs: 5, md: 7 },
          px: { xs: 3, sm: 6, md: 10 },
        }}
      >
        <Box sx={{ maxWidth: 620, mx: 'auto' }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: theme.palette.text.secondary, mb: 3, textTransform: 'uppercase',
          }}>
            How it works
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((item, i) => (
              <Box key={item.step} sx={{ display: 'flex', gap: 2.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${accent}30 0%, #7C3AED25 100%)`,
                    border: `1.5px solid ${accent}45`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: accent }}>{item.step}</Typography>
                  </Box>
                  {i < steps.length - 1 && (
                    <Box sx={{
                      width: 1.5, flex: 1, minHeight: 24, my: 0.5,
                      background: `linear-gradient(to bottom, ${accent}30, transparent)`,
                    }} />
                  )}
                </Box>
                <Box sx={{ pb: i < steps.length - 1 ? 3 : 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary, mb: 0.5 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.65 }}>
                    {item.sub}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Sidebar callout ──────────────────────────────────────────────────── */}
      <Box sx={{
        width: '100%',
        bgcolor: isDark ? '#161616' : '#fff',
        borderTop: `1px solid ${cardBorder}`,
        py: { xs: 4, md: 5 },
        px: { xs: 3, sm: 6, md: 10 },
      }}>
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          <Box sx={{
            display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' }, gap: 3,
            p: 3, borderRadius: '16px',
            bgcolor: cardBg, border: `1.5px solid ${cardBorder}`,
          }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '14px', flexShrink: 0,
              bgcolor: `${accent}15`, color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, mb: 0.4 }}>
                All your conversations, always in the sidebar
              </Typography>
              <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.6 }}>
                Every session is saved and searchable — just like ChatGPT or Claude. Pick up right where you
                left off, or branch a new conversation from any previous frame.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/studio')}
              sx={{
                borderRadius: '10px', px: 2.5, py: 1,
                fontSize: 13, fontWeight: 600,
                borderColor: accent, color: accent,
                textTransform: 'none', flexShrink: 0,
                '&:hover': { bgcolor: `${accent}0d` },
              }}
            >
              Start learning
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <Box sx={{
        width: '100%',
        py: 3,
        px: { xs: 3, sm: 6, md: 10 },
        borderTop: `1px solid ${cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <FiberManualRecordIcon sx={{ fontSize: 6, color: theme.palette.text.disabled }} />
        <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
          Built with the belief that understanding should never be a barrier to learning.
        </Typography>
        <FiberManualRecordIcon sx={{ fontSize: 6, color: theme.palette.text.disabled }} />
      </Box>

    </Box>
  )
}
