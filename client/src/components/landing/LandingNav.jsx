import { Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useColorMode } from '../../App'
import { ROUTES } from '../../constants/routes.js'
import { useLandingTheme } from './tokens.js'
import ParalyteLogo from '../common/ParalyteLogo.jsx'

const LINKS = [
  { label: 'Why',          id: 'why' },
  { label: 'How it works', id: 'how' },
  { label: 'The studio',   id: 'studio' },
  { label: 'Vision',       id: 'vision' },
]

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingNav() {
  const P              = useLandingTheme()
  const navigate       = useNavigate()
  const { mode, toggle } = useColorMode()
  const isDark = mode === 'dark'

  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky', top: 0, zIndex: 30,
        mb: '-76px',            // overlap the hero instead of consuming layout height
        height: 76,
        display: 'flex', alignItems: 'center',
        px: { xs: '5%', md: '6%' },
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        background: P.isDark
          ? 'linear-gradient(180deg, rgba(4,8,10,0.72) 0%, rgba(4,8,10,0) 100%)'
          : 'linear-gradient(180deg, rgba(247,250,248,0.78) 0%, rgba(247,250,248,0) 100%)',
      }}
    >
      {/* Wordmark */}
      <Box
        onClick={() => scrollToId('top')}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
      >
        <ParalyteLogo sx={{ fontSize: 26, color: P.green }} />
        <Box sx={{ fontFamily: P.fontDisplay, fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em', color: P.text0 }}>
          Paralyte
        </Box>
      </Box>

      {/* Center links */}
      <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center', gap: '34px' }}>
        {LINKS.map((l) => (
          <Box
            key={l.id}
            onClick={() => scrollToId(l.id)}
            sx={{
              fontFamily: P.fontBody, fontSize: 15, color: P.text1,
              cursor: 'pointer', userSelect: 'none',
              transition: 'color 0.2s',
              '&:hover': { color: P.text0 },
            }}
          >
            {l.label}
          </Box>
        ))}
      </Box>

      {/* Right cluster */}
      <Box sx={{ ml: { xs: 'auto', md: 0 }, display: 'flex', alignItems: 'center', gap: { xs: '12px', md: '18px' } }}>
        {/* Theme toggle */}
        <Box
          onClick={toggle}
          aria-label="Toggle theme"
          sx={{
            display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
            color: P.text2, transition: 'color 0.2s',
            '&:hover': { color: P.text0 },
          }}
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          )}
        </Box>

        {/* Sign in */}
        <Box
          onClick={() => navigate(ROUTES.LOGIN)}
          sx={{
            fontFamily: P.fontBody, fontSize: 15, color: P.text1,
            cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
            transition: 'color 0.2s',
            '&:hover': { color: P.text0 },
          }}
        >
          Sign in
        </Box>
      </Box>
    </Box>
  )
}
