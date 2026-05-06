import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Box, Typography, Button, Alert, useTheme,
  TextField, InputAdornment, IconButton, Divider, useMediaQuery,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { motion, useReducedMotion } from 'framer-motion'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'
import { BRAND, PALETTE } from '../theme/tokens.js'
import { ROUTES } from '../constants/routes.js'

const MotionBox = motion(Box)
const MotionG   = motion.g

// ── Google logo ───────────────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ── Rocket SVG animation ──────────────────────────────────────────────────────
function RocketScene() {
  const reduced = useReducedMotion()

  const assemble = (delay, initial, animate) =>
    reduced
      ? { opacity: 1 }
      : { initial: { opacity: 0, ...initial }, animate: { opacity: 1, ...animate }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } }

  const floatProps = reduced ? {} : {
    animate: { y: [0, -10, 0] },
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  }

  const flameProps = reduced ? {} : {
    animate: { opacity: [0.8, 1, 0.75, 1], scaleY: [1, 1.08, 0.94, 1] },
    transition: { duration: 0.55, repeat: Infinity, ease: 'easeInOut' },
  }

  // Particles
  const particles = [
    { cx: 100, delay: 0,    size: 3 },
    { cx: 93,  delay: 0.18, size: 2 },
    { cx: 107, delay: 0.32, size: 2.5 },
    { cx: 97,  delay: 0.5,  size: 2 },
    { cx: 103, delay: 0.65, size: 3 },
  ]

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 2 }}>
      <svg width="200" height="260" viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <linearGradient id="flameGrad" x1="100" y1="200" x2="100" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF6B35"/>
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="flameGrad2" x1="100" y1="200" x2="100" y2="225" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C42"/>
            <stop offset="100%" stopColor="#FFD166" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="bodyGrad" x1="80" y1="80" x2="120" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a1a2e"/>
            <stop offset="100%" stopColor="#16213e"/>
          </linearGradient>
        </defs>

        {/* Floating wrapper */}
        <MotionG {...floatProps}>

          {/* Particles (behind rocket) */}
          {!reduced && particles.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.cx}
              cy={215}
              r={p.size}
              fill="#FF6B35"
              initial={{ opacity: 0, cy: 215 }}
              animate={{ opacity: [0, 0.8, 0], cy: [215, 240, 255] }}
              transition={{ duration: 1.2, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}

          {/* Flame */}
          <MotionG style={{ transformOrigin: '100px 205px' }} {...flameProps}>
            <motion.g {...assemble(0.6, { opacity: 0 }, { opacity: 1 })}>
              {/* Main flame */}
              <path d="M87 202 Q100 245 113 202" fill="url(#flameGrad)" />
              {/* Inner bright core */}
              <path d="M93 202 Q100 228 107 202" fill="url(#flameGrad2)" />
              {/* Side flickers */}
              <path d="M86 205 Q81 225 90 210" fill="#FF6B35" opacity="0.5" />
              <path d="M114 205 Q119 225 110 210" fill="#FF6B35" opacity="0.5" />
            </motion.g>
          </MotionG>

          {/* Left fin */}
          <motion.g {...assemble(0.3, { x: -20 }, { x: 0 })}>
            <path d="M80 160 L65 195 L80 190 Z" fill={BRAND.primary} opacity="0.9"/>
            <path d="M80 160 L65 195 L80 190 Z" fill={BRAND.accent} opacity="0.3"/>
          </motion.g>

          {/* Right fin */}
          <motion.g {...assemble(0.3, { x: 20 }, { x: 0 })}>
            <path d="M120 160 L135 195 L120 190 Z" fill={BRAND.primary} opacity="0.9"/>
            <path d="M120 160 L135 195 L120 190 Z" fill={BRAND.accent} opacity="0.3"/>
          </motion.g>

          {/* Body */}
          <motion.g {...assemble(0, { y: 15 }, { y: 0 })}>
            <rect x="80" y="90" width="40" height="115" rx="2" fill="url(#bodyGrad)"/>
            {/* Side accent lines */}
            <rect x="80" y="90" width="3" height="115" rx="1" fill={BRAND.accent} opacity="0.6"/>
            <rect x="117" y="90" width="3" height="115" rx="1" fill={BRAND.accent} opacity="0.6"/>
            {/* Bottom nozzle */}
            <rect x="85" y="195" width="30" height="10" rx="2" fill="#0d0d1a"/>
            <rect x="88" y="198" width="24" height="4" rx="1" fill={BRAND.accent} opacity="0.4"/>
          </motion.g>

          {/* Nose cone */}
          <motion.g {...assemble(0.15, { y: -15 }, { y: 0 })}>
            <path d="M80 90 Q100 45 120 90 Z" fill="#6B44F8"/>
            {/* Nose highlight */}
            <path d="M91 90 Q100 55 109 90 Z" fill="#8B6FF8" opacity="0.5"/>
          </motion.g>

          {/* Window */}
          <motion.g {...assemble(0.45, { scale: 0 }, { scale: 1 })}>
            <circle cx="100" cy="140" r="13" fill={BRAND.accent} opacity="0.25"/>
            <circle cx="100" cy="140" r="10" fill="#1a1a3e" stroke={BRAND.accent} strokeWidth="1.5"/>
            <circle cx="100" cy="140" r="6"  fill={BRAND.accent} opacity="0.15"/>
            {/* Window reflection */}
            <circle cx="96" cy="136" r="2.5" fill="white" opacity="0.35"/>
          </motion.g>

          {/* Stars around rocket */}
          {!reduced && [
            { cx: 42, cy: 90,  r: 1.5, delay: 0.8 },
            { cx: 160, cy: 110, r: 1,   delay: 1 },
            { cx: 35,  cy: 150, r: 1,   delay: 1.1 },
            { cx: 165, cy: 160, r: 1.5, delay: 0.9 },
            { cx: 55,  cy: 185, r: 1,   delay: 1.2 },
          ].map((s, i) => (
            <motion.circle
              key={i}
              cx={s.cx} cy={s.cy} r={s.r}
              fill="white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.3, 0.8, 0] }}
              transition={{ duration: 3, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

        </MotionG>
      </svg>
    </Box>
  )
}

// ── Feature list ──────────────────────────────────────────────────────────────
const FEATURES = [
  { dot: BRAND.accent, text: 'Multimodal inference pipelines that turn prompts into structured lessons' },
  { dot: '#6B44F8',   text: 'Spatial reasoning engine renders diagrams, animations & narration in sync' },
  { dot: '#FF6B35',   text: 'Adaptive knowledge graphs — any domain, any depth, sub-second latency' },
]

// ── Left panel (branding + rocket) ────────────────────────────────────────────
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
            background: 'radial-gradient(circle, rgba(75,114,255,0.18) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
        <MotionBox
          animate={{ x: [0, -20, 0], y: [0, 22, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          sx={{
            position: 'absolute', bottom: '-5%', right: '-10%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107,68,248,0.18) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </Box>

      {/* Content — fills the panel with top/middle/bottom rhythm */}
      <Box sx={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 580,
        height: isMobile ? 'auto' : '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        textAlign: isMobile ? 'center' : 'left',
        py: isMobile ? 0 : 2,
      }}>

        {/* TOP — logo + tagline */}
        <MotionBox
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge */}
          {!isMobile && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 1.5, py: 0.5, mb: 3,
              border: `1px solid ${BRAND.accent}55`,
              borderRadius: '4px',
              bgcolor: `${BRAND.accent}14`,
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: BRAND.accent }} />
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', fontWeight: 500 }}>
                INFERENCE ENGINE v2
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
            From raw curiosity to structured knowledge —<br />
            rendered in seconds.
          </Typography>
        </MotionBox>

        {/* MIDDLE — rocket */}
        {!isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', ml: -4 }}>
            <RocketScene />
          </Box>
        )}

        {/* BOTTOM — features + CTA */}
        {!isMobile && (
          <Box>
            <MotionBox
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
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
              transition={{ duration: 0.4, delay: 1.1 }}
              sx={{ pt: 3, borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                Don't have an account?{' '}
                <Typography
                  component={Link}
                  to="/register"
                  sx={{
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: BRAND.gradientAlt,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    '&:hover': { opacity: 0.8 },
                  }}
                >
                  Create account →
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

// ── No-client-id fallback ─────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function Login() {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (!GOOGLE_CLIENT_ID) {
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', bgcolor: 'background.default', p: 3,
      }}>
        <Box sx={{ maxWidth: 420, textAlign: 'center', p: 4, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, bgcolor: 'background.paper' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17, mb: 1 }}>
            Google Client ID not configured
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.7 }}>
            Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>client/.env</code> and restart the dev server.
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh' }}>
      <LeftPanel isMobile={isMobile} />
      <LoginForm isMobile={isMobile} />
    </Box>
  )
}

// ── Right panel — form ────────────────────────────────────────────────────────
function LoginForm({ isMobile }) {
  const { login, loginWithPassword } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const theme     = useTheme()
  const isDark    = theme.palette.mode === 'dark'

  const [mode, setMode]         = useState('google')   // 'google' | 'email'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const from = location.state?.from?.pathname || ROUTES.STUDIO

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('')
      setLoading(true)
      try {
        await login(tokenResponse.access_token)
        navigate(from, { replace: true })
      } catch (err) {
        setError(err.message || 'Sign-in failed. Please try again.')
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.')
      setLoading(false)
    },
    flow: 'implicit',
  })

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithPassword(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'

  return (
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
            Welcome back
          </Typography>
          <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
            Sign in to your Zenith account.
          </Typography>
        </Box>

        {/* Error */}
        {error && (
          <MotionBox initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <Alert severity="error" sx={{ borderRadius: '4px', fontSize: 13 }}>{error}</Alert>
          </MotionBox>
        )}

        {/* Google button */}
        <Button
          fullWidth
          onClick={() => { setError(''); googleLogin() }}
          disabled={loading}
          startIcon={<GoogleLogo />}
          variant="outlined"
          sx={{
            borderRadius: '4px',
            borderColor,
            color: 'text.primary',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            py: 1.3, fontSize: 14, fontWeight: 500, textTransform: 'none',
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f8f8f8',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)',
            },
          }}
        >
          {loading && mode === 'google' ? 'Signing in…' : 'Continue with Google'}
        </Button>

        {/* Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 12, color: 'text.disabled', whiteSpace: 'nowrap' }}>or</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        {/* Email/password section */}
        {mode === 'google' ? (
          <Button
            fullWidth
            variant="outlined"
            onClick={() => { setMode('email'); setError('') }}
            sx={{
              borderRadius: '4px', py: 1.3, fontSize: 14,
              fontWeight: 500, textTransform: 'none',
              borderColor,
              color: 'text.secondary',
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor },
            }}
          >
            Sign in with email
          </Button>
        ) : (
          <Box component="form" onSubmit={handleEmailLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth size="small" label="Email" type="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoFocus sx={fieldSx}
            />
            <TextField
              fullWidth size="small" label="Password" type={showPass ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              required sx={fieldSx}
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
            <Button
              fullWidth type="submit" variant="contained" disabled={loading}
              sx={{
                borderRadius: '4px', py: 1.3, fontSize: 14,
                fontWeight: 600, textTransform: 'none',
                background: BRAND.gradient,
                boxShadow: 'none',
                '&:hover': { background: BRAND.gradientHover, boxShadow: 'none' },
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              size="small" variant="text"
              onClick={() => { setMode('google'); setError('') }}
              sx={{ textTransform: 'none', fontSize: 13, color: 'text.disabled', alignSelf: 'flex-start', p: 0 }}
            >
              ← Back
            </Button>
          </Box>
        )}

        {/* Register link */}
        <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Typography
            component={Link} to="/register"
            sx={{
              fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Create one
          </Typography>
        </Typography>

        <Typography sx={{ fontSize: 11.5, color: 'text.disabled', textAlign: 'center', lineHeight: 1.6, mt: -1 }}>
          By signing in you agree to our Terms of Service · Privacy Policy
        </Typography>
      </MotionBox>
    </Box>
  )
}
