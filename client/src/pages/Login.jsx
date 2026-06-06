import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment, IconButton, Divider,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { motion, useReducedMotion } from 'framer-motion'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'
import { useIsDark } from '../hooks/useIsDark.js'
import { BRAND, RADIUS } from '../theme/tokens.js'
import { ROUTES } from '../constants/routes.js'
import { neutralGhost } from '../theme/styleUtils.js'
import AuthShell from '../components/common/AuthShell.jsx'

const MotionG = motion.g

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

        <MotionG {...floatProps}>
          {!reduced && particles.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.cx} cy={215} r={p.size} fill="#FF6B35"
              initial={{ opacity: 0, cy: 215 }}
              animate={{ opacity: [0, 0.8, 0], cy: [215, 240, 255] }}
              transition={{ duration: 1.2, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}

          <MotionG style={{ transformOrigin: '100px 205px' }} {...flameProps}>
            <motion.g {...assemble(0.6, { opacity: 0 }, { opacity: 1 })}>
              <path d="M87 202 Q100 245 113 202" fill="url(#flameGrad)" />
              <path d="M93 202 Q100 228 107 202" fill="url(#flameGrad2)" />
              <path d="M86 205 Q81 225 90 210" fill="#FF6B35" opacity="0.5" />
              <path d="M114 205 Q119 225 110 210" fill="#FF6B35" opacity="0.5" />
            </motion.g>
          </MotionG>

          <motion.g {...assemble(0.3, { x: -20 }, { x: 0 })}>
            <path d="M80 160 L65 195 L80 190 Z" fill={BRAND.primary} opacity="0.9"/>
            <path d="M80 160 L65 195 L80 190 Z" fill={BRAND.accent} opacity="0.3"/>
          </motion.g>

          <motion.g {...assemble(0.3, { x: 20 }, { x: 0 })}>
            <path d="M120 160 L135 195 L120 190 Z" fill={BRAND.primary} opacity="0.9"/>
            <path d="M120 160 L135 195 L120 190 Z" fill={BRAND.accent} opacity="0.3"/>
          </motion.g>

          <motion.g {...assemble(0, { y: 15 }, { y: 0 })}>
            <rect x="80" y="90" width="40" height="115" rx="2" fill="url(#bodyGrad)"/>
            <rect x="80" y="90" width="3" height="115" rx="1" fill={BRAND.accent} opacity="0.6"/>
            <rect x="117" y="90" width="3" height="115" rx="1" fill={BRAND.accent} opacity="0.6"/>
            <rect x="85" y="195" width="30" height="10" rx="2" fill="#0d0d1a"/>
            <rect x="88" y="198" width="24" height="4" rx="1" fill={BRAND.accent} opacity="0.4"/>
          </motion.g>

          <motion.g {...assemble(0.15, { y: -15 }, { y: 0 })}>
            <path d="M80 90 Q100 45 120 90 Z" fill="#6B44F8"/>
            <path d="M91 90 Q100 55 109 90 Z" fill="#8B6FF8" opacity="0.5"/>
          </motion.g>

          <motion.g {...assemble(0.45, { scale: 0 }, { scale: 1 })}>
            <circle cx="100" cy="140" r="13" fill={BRAND.accent} opacity="0.25"/>
            <circle cx="100" cy="140" r="10" fill="#1a1a3e" stroke={BRAND.accent} strokeWidth="1.5"/>
            <circle cx="100" cy="140" r="6"  fill={BRAND.accent} opacity="0.15"/>
            <circle cx="96" cy="136" r="2.5" fill="white" opacity="0.35"/>
          </motion.g>

          {!reduced && [
            { cx: 42, cy: 90,  r: 1.5, delay: 0.8 },
            { cx: 160, cy: 110, r: 1,   delay: 1 },
            { cx: 35,  cy: 150, r: 1,   delay: 1.1 },
            { cx: 165, cy: 160, r: 1.5, delay: 0.9 },
            { cx: 55,  cy: 185, r: 1,   delay: 1.2 },
          ].map((s, i) => (
            <motion.circle
              key={i}
              cx={s.cx} cy={s.cy} r={s.r} fill="white"
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

const FEATURES = [
  { dot: BRAND.accent, text: 'Multimodal inference pipelines that turn prompts into structured lessons' },
  { dot: '#6B44F8',   text: 'Spatial reasoning engine renders diagrams, animations & narration in sync' },
  { dot: '#FF6B35',   text: 'Adaptive knowledge graphs — any domain, any depth, sub-second latency' },
]

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.sm}px` } }

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function Login() {
  const isDark = useIsDark()

  if (!GOOGLE_CLIENT_ID) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
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

  return <LoginForm />
}

function LoginForm() {
  const { login, loginWithPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark   = useIsDark()

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
    <AuthShell
      art={<RocketScene />}
      badge={{ label: 'INFERENCE ENGINE v2', color: BRAND.accent }}
      tagline={<>From raw curiosity to structured knowledge —<br />rendered in seconds.</>}
      features={FEATURES}
      orbTop="rgba(75,114,255,0.18)"
      orbBottom="rgba(107,68,248,0.18)"
      altPrompt="Don't have an account?"
      altTo="/register"
      altLabelLeft="Create account →"
      altLabelRight="Create one"
      heading="Welcome back"
      subheading="Sign in to your Paralyte account."
      error={error}
      terms="By signing in you agree to our Terms of Service · Privacy Policy"
    >
      {/* Google button */}
      <Button
        fullWidth
        onClick={() => { setError(''); googleLogin() }}
        disabled={loading}
        startIcon={<GoogleLogo />}
        variant="outlined"
        sx={{
          borderRadius: '4px', borderColor, color: 'text.primary',
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

      {/* Email / password */}
      {mode === 'google' ? (
        <Button
          fullWidth variant="outlined"
          onClick={() => { setMode('email'); setError('') }}
          sx={{
            borderRadius: '4px', py: 1.3, fontSize: 14, fontWeight: 500, textTransform: 'none',
            borderColor, color: 'text.secondary',
            '&:hover': { bgcolor: neutralGhost(isDark), borderColor },
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
                    <IconButton size="small" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass((p) => !p)} edge="end">
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
              borderRadius: '4px', py: 1.3, fontSize: 14, fontWeight: 600, textTransform: 'none',
              backgroundColor: BRAND.primary, boxShadow: 'none',
              '&:hover': { backgroundColor: BRAND.hover, boxShadow: 'none' },
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
    </AuthShell>
  )
}
