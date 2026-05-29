import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DARK, LIGHT, LandingThemeProvider } from '../components/landing/tokens.js'
import LandingHero     from '../components/landing/LandingHero.jsx'
import LandingProblem  from '../components/landing/LandingProblem.jsx'
import LandingFeatures from '../components/landing/LandingFeatures.jsx'
import LandingDemo     from '../components/landing/LandingDemo.jsx'
import LandingEnd      from '../components/landing/LandingEnd.jsx'

export default function AboutUs() {
  const theme  = useTheme()
  const tokens = theme.palette.mode === 'dark' ? DARK : LIGHT

  return (
    <LandingThemeProvider tokens={tokens}>
      <Box sx={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', bgcolor: tokens.bg0 }}>
        <LandingHero />
        <LandingProblem />
        <LandingFeatures />
        <LandingDemo />
        <LandingEnd />
      </Box>
    </LandingThemeProvider>
  )
}
