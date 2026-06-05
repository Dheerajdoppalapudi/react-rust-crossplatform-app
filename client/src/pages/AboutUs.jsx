import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DARK, LIGHT, LandingThemeProvider } from '../components/landing/tokens.js'
import LandingNav      from '../components/landing/LandingNav.jsx'
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
        <LandingNav />
        <Box id="top" />
        <LandingHero />
        <Box id="why"    sx={{ scrollMarginTop: '76px' }}><LandingProblem /></Box>
        <Box id="how"    sx={{ scrollMarginTop: '76px' }}><LandingFeatures /></Box>
        <Box id="studio" sx={{ scrollMarginTop: '76px' }}><LandingDemo /></Box>
        <LandingEnd />
      </Box>
    </LandingThemeProvider>
  )
}
