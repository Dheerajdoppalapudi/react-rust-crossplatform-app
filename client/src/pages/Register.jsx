import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Typography, Button, Alert, useTheme,
  TextField, InputAdornment, IconButton, useMediaQuery,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../theme/tokens.js'
import { ROUTES } from '../constants/routes.js'

const MotionBox = motion(Box)

// ── Orbiting stars decoration ─────────────────────────────────────────────────
function StarField() {
  const reduced = useReducedMotion()
  const stars = [
    { cx: 80,  cy: 90,  r: 2,   delay: 0 },
    { cx: 160, cy: 120, r: 1.5, delay: 0.4 },
    { cx: 60,  cy: 155, r: 1,   delay: 0.7 },
    { cx: 155, cy: 170, r: 2,   delay: 0.2 },
    { cx: 100, cy: 70,  r: 1.5, delay: 0.9 },
    { cx: 45,  cy: 130, r: 1,   delay: 0.5 },
    { cx: 165, cy: 90,  r: 1,   delay: 1.1 },
    { cx: 115, cy: 185, r: 1.5, delay: 0.3 },
    { cx: 75,  cy: 195, r: 1,   delay: 0.8 },
  ]

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 2 }}>
      <svg width="200" height="220" viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="regGrad" x1="60" y1="60" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={BRAND.primary}/>
            <stop offset="100%" stopColor="#6B44F8"/>
          </linearGradient>
        </defs>

        {/* Central Zenith mark — stylised Z */}
        <motion.g
          initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '100px 130px' }}
        >
          {/* Outer ring */}
          <circle cx="100" cy="130" r="52" stroke="url(#regGrad)" strokeWidth="1" opacity="0.25"/>
          <circle cx="100" cy="130" r="38" stroke="url(#regGrad)" strokeWidth="1" opacity="0.18"/>

          {/* Z letter */}
          <text
            x="100" y="148"
            textAnchor="middle"
            fontSize="52"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            fill="url(#regGrad)"
            opacity="0.85"
          >
            Z
          </text>
        </motion.g>

        {/* Orbiting stars */}
        {stars.map((s, i) => (
          reduced ? null : (
            <motion.circle
              key={i}
              cx={s.cx} cy={s.cy} r={s.r}
              fill="white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0.3, 0.9, 0] }}
              transition={{ duration: 2.5 + i * 0.2, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          )
        ))}

        {/* Floating dots on ring */}
        {!reduced && [0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2
          const cx = 100 + Math.cos(angle) * 52
          const cy = 130 + Math.sin(angle) * 52
          return (
            <motion.circle
              key={`dot-${i}`}
              cx={cx} cy={cy} r={3}
              fill={i % 2 === 0 ? BRAND.accent : '#6B44F8'}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )
        })}
      </svg>
    </Box>
  )
}

// ── Feature list ──────────────────────────────────────────────────────────────
const FEATURES = [
  { dot: BRAND.accent, text: 'Persistent session context — your learning history informs every generation' },
  { dot: '#6B44F8',   text: 'Full ownership of your inference outputs and conversation threads' },
  { dot: '#FF6B35', text: 'No setup. Connect and your first lesson renders in under 10 seconds' },
]

// ── Left panel ────────────────────────────────────────────────────────────────
function LeftPanel({ isMobile }) {
  return (
    <Box sx={{
      width: isMobile ? '100%' : '60%',
      minHeight: isMobile ? '220px' : '100vh',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #0d0d1a 0%, #0a0a0a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: isMobile ? 3 : 7,
      py: isMobile ? 4 : 7,
      gap: isMobile ? 1.5 : 2,
    }}>
      {/* Orbs */}
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <MotionBox
          animate={{ x: [0, 25, 0], y: [0, -18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            position: 'absolute', top: '-5%', left: '-10%',
            width: 350, height: 350, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107,68,248,0.18) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
        <MotionBox
          animate={{ x: [0, -20, 0], y: [0, 22, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          sx={{
            position: 'absolute', bottom: '-5%', right: '-10%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(75,114,255,0.18) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 580,
        height: isMobile ? 'auto' : '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        textAlign: isMobile ? 'center' : 'left',
        py: isMobile ? 0 : 2,
      }}>

        {/* TOP */}
        <MotionBox
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {!isMobile && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 1.5, py: 0.5, mb: 3,
              border: '1px solid rgba(107,68,248,0.35)',
              borderRadius: '4px',
              bgcolor: 'rgba(107,68,248,0.08)',
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6B44F8' }} />
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', fontWeight: 500 }}>
                JOIN THE PLATFORM
              </Typography>
            </Box>
          )}
          <Typography sx={{
            fontSize: isMobile ? 36 : 64, fontWeight: 800, letterSpacing: '-2px',
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1, mb: 2,
          }}>
            Zenith
          </Typography>
          <Typography sx={{ fontSize: isMobile ? 14 : 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 420 }}>
            Deploy your own inference-powered<br />learning environment.
          </Typography>
        </MotionBox>

        {/* MIDDLE */}
        {!isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', ml: -4 }}>
            <StarField />
          </Box>
        )}

        {/* BOTTOM */}
        {!isMobile && (
          <Box>
            <MotionBox
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}
            >
              {FEATURES.map((f, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '4px', flexShrink: 0,
                    bgcolor: `${f.dot}22`, border: `1px solid ${f.dot}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.1,
                  }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: f.dot }} />
                  </Box>
                  <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    {f.text}
                  </Typography>
                </Box>
              ))}
            </MotionBox>

            <MotionBox
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.9 }}
              sx={{ pt: 3, borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              Already have an account?{' '}
              <Typography
                component={Link}
                to="/login"
                sx={{
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: BRAND.gradientAlt,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                Sign in →
              </Typography>
            </Typography>
            </MotionBox>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Field style helper ────────────────────────────────────────────────────────
const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '4px' },
}

// ── Register page ─────────────────────────────────────────────────────────────
export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()
  const theme        = useTheme()
  const isDark       = theme.palette.mode === 'dark'
  const isMobile     = useMediaQuery(theme.breakpoints.down('md'))

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(name.trim(), email, password)
      navigate(ROUTES.STUDIO, { replace: true })
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'

  return (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh' }}>
      <LeftPanel isMobile={isMobile} />

      {/* Right panel — form */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderLeft: isMobile ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        borderTop: isMobile ? `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` : 'none',
        px: isMobile ? 4 : 6,
        py: isMobile ? 5 : 0,
        overflowY: 'auto',
      }}>
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          sx={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 3.5 }}
        >
          {/* Heading */}
          <Box>
            <Typography sx={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.8px', mb: 0.75 }}>
              Create your account
            </Typography>
            <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
              Get started with Zenith for free.
            </Typography>
          </Box>

          {/* Error */}
          {error && (
            <MotionBox initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Alert severity="error" sx={{ borderRadius: '4px', fontSize: 13 }}>{error}</Alert>
            </MotionBox>
          )}

          {/* Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              fullWidth size="small" label="Full name"
              value={name} onChange={(e) => setName(e.target.value)}
              required autoFocus sx={fieldSx}
            />
            <TextField
              fullWidth size="small" label="Email" type="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required sx={fieldSx}
            />
            <TextField
              fullWidth size="small" label="Password" type={showPass ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              required helperText="At least 8 characters" sx={fieldSx}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPass((p) => !p)} edge="end">
                        {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth size="small" label="Confirm password" type={showConf ? 'text' : 'password'}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              required sx={fieldSx}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConf((p) => !p)} edge="end">
                        {showConf ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              fullWidth type="submit" variant="contained" disabled={loading}
              sx={{
                borderRadius: '4px', py: 1.3, fontSize: 14,
                fontWeight: 600, textTransform: 'none', mt: 0.5,
                background: BRAND.gradient,
                boxShadow: 'none',
                '&:hover': { background: BRAND.gradientHover, boxShadow: 'none' },
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </Box>

          {/* Login link */}
          <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
            Already have an account?{' '}
            <Typography
              component={Link} to="/login"
              sx={{
                fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Sign in
            </Typography>
          </Typography>

          <Typography sx={{ fontSize: 11.5, color: 'text.disabled', textAlign: 'center', lineHeight: 1.6, mt: -1 }}>
            By creating an account you agree to our Terms of Service · Privacy Policy
          </Typography>
        </MotionBox>
      </Box>
    </Box>
  )
}
