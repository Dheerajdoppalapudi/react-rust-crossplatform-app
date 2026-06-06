import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, InputAdornment, IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../theme/tokens.js'
import { ROUTES } from '../constants/routes.js'
import AuthShell from '../components/common/AuthShell.jsx'

const MotionG = motion.g

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

        <MotionG
          initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '100px 130px' }}
        >
          <circle cx="100" cy="130" r="52" stroke="url(#regGrad)" strokeWidth="1" opacity="0.25"/>
          <circle cx="100" cy="130" r="38" stroke="url(#regGrad)" strokeWidth="1" opacity="0.18"/>
          <text x="100" y="148" textAnchor="middle" fontSize="52" fontWeight="800" fontFamily="Inter, sans-serif" fill="url(#regGrad)" opacity="0.85">
            Z
          </text>
        </MotionG>

        {stars.map((s, i) => (
          reduced ? null : (
            <motion.circle
              key={i}
              cx={s.cx} cy={s.cy} r={s.r} fill="white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0.3, 0.9, 0] }}
              transition={{ duration: 2.5 + i * 0.2, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          )
        ))}

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

const FEATURES = [
  { dot: BRAND.accent, text: 'Persistent session context — your learning history informs every generation' },
  { dot: '#6B44F8',   text: 'Full ownership of your inference outputs and conversation threads' },
  { dot: '#FF6B35',   text: 'No setup. Connect and your first lesson renders in under 10 seconds' },
]

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '4px' } }

export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()

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

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

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

  return (
    <AuthShell
      art={<StarField />}
      badge={{ label: 'JOIN THE PLATFORM', color: '#6B44F8' }}
      tagline={<>Deploy your own inference-powered<br />learning environment.</>}
      features={FEATURES}
      orbTop="rgba(107,68,248,0.18)"
      orbBottom="rgba(75,114,255,0.18)"
      altPrompt="Already have an account?"
      altTo="/login"
      altLabelLeft="Sign in →"
      altLabelRight="Sign in"
      heading="Create your account"
      subheading="Get started with Paralyte for free."
      error={error}
      terms="By creating an account you agree to our Terms of Service · Privacy Policy"
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                  <IconButton size="small" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass((p) => !p)} edge="end">
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
                  <IconButton size="small" aria-label={showConf ? 'Hide password' : 'Show password'} onClick={() => setShowConf((p) => !p)} edge="end">
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
            borderRadius: '4px', py: 1.3, fontSize: 14, fontWeight: 600, textTransform: 'none', mt: 0.5,
            backgroundColor: BRAND.primary, boxShadow: 'none',
            '&:hover': { backgroundColor: BRAND.hover, boxShadow: 'none' },
          }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </Box>
    </AuthShell>
  )
}
