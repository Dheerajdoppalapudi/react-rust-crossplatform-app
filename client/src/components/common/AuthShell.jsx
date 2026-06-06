import { Box, Typography, Alert, useTheme, useMediaQuery } from '@mui/material'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useIsDark } from '../../hooks/useIsDark.js'
import { BRAND } from '../../theme/tokens.js'

const MotionBox = motion(Box)

// The auth screens share one layout: a fixed dark branding panel on the left and
// a theme-aware form panel on the right. Login/Register pass in only what differs
// — art, badge, copy, features, orb colours, and the form fields (children).
//
// Note: the left panel is an always-dark branded surface, so its white-alpha
// rgba() values are intentional literals (not theme-neutral helpers).

function LeftPanel({ isMobile, badge, tagline, art, features, altPrompt, altTo, altLabel, orbTop, orbBottom }) {
  return (
    <Box sx={{
      width: isMobile ? '100%' : '60%',
      minHeight: isMobile ? '220px' : '100vh',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #0d0d1a 0%, #0a0a0a 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
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
            background: `radial-gradient(circle, ${orbTop} 0%, transparent 70%)`,
            filter: 'blur(50px)',
          }}
        />
        <MotionBox
          animate={{ x: [0, -20, 0], y: [0, 22, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          sx={{
            position: 'absolute', bottom: '-5%', right: '-10%',
            width: 300, height: 300, borderRadius: '50%',
            background: `radial-gradient(circle, ${orbBottom} 0%, transparent 70%)`,
            filter: 'blur(50px)',
          }}
        />
      </Box>

      {/* Content — top / middle / bottom rhythm */}
      <Box sx={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 580,
        height: isMobile ? 'auto' : '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        textAlign: isMobile ? 'center' : 'left',
        py: isMobile ? 0 : 2,
      }}>
        {/* TOP — badge + wordmark + tagline */}
        <MotionBox
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {!isMobile && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 1.5, py: 0.5, mb: 3,
              border: `1px solid ${badge.color}55`,
              borderRadius: '4px',
              bgcolor: `${badge.color}14`,
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: badge.color }} />
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', fontWeight: 500 }}>
                {badge.label}
              </Typography>
            </Box>
          )}

          <Typography sx={{
            fontSize: isMobile ? 36 : 64, fontWeight: 800, letterSpacing: '-2px',
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1, mb: 2,
          }}>
            Paralyte
          </Typography>
          <Typography sx={{ fontSize: isMobile ? 14 : 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 420 }}>
            {tagline}
          </Typography>
        </MotionBox>

        {/* MIDDLE — decorative art */}
        {!isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', ml: -4 }}>
            {art}
          </Box>
        )}

        {/* BOTTOM — features + switch link */}
        {!isMobile && (
          <Box>
            <MotionBox
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}
            >
              {features.map((f, i) => (
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
              transition={{ duration: 0.4, delay: 1 }}
              sx={{ pt: 3, borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                {altPrompt}{' '}
                <Typography
                  component={Link}
                  to={altTo}
                  sx={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: BRAND.primary, '&:hover': { opacity: 0.8 } }}
                >
                  {altLabel}
                </Typography>
              </Typography>
            </MotionBox>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default function AuthShell({
  // left panel
  art, badge, tagline, features, orbTop, orbBottom,
  altPrompt, altTo, altLabelLeft, altLabelRight,
  // right panel
  heading, subheading, error, terms, children,
}) {
  const theme    = useTheme()
  const isDark   = useIsDark()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const panelBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'

  return (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh' }}>
      <LeftPanel
        isMobile={isMobile}
        badge={badge} tagline={tagline} art={art} features={features}
        altPrompt={altPrompt} altTo={altTo} altLabel={altLabelLeft}
        orbTop={orbTop} orbBottom={orbBottom}
      />

      {/* Right panel — form */}
      <Box sx={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.paper',
        borderLeft: isMobile ? 'none' : `1px solid ${panelBorder}`,
        borderTop: isMobile ? `1px solid ${panelBorder}` : 'none',
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
              {heading}
            </Typography>
            <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
              {subheading}
            </Typography>
          </Box>

          {/* Error */}
          {error && (
            <MotionBox initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Alert severity="error" sx={{ borderRadius: '4px', fontSize: 13 }}>{error}</Alert>
            </MotionBox>
          )}

          {/* Page-specific form controls */}
          {children}

          {/* Switch link */}
          <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
            {altPrompt}{' '}
            <Typography
              component={Link} to={altTo}
              sx={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            >
              {altLabelRight}
            </Typography>
          </Typography>

          <Typography sx={{ fontSize: 11.5, color: 'text.disabled', textAlign: 'center', lineHeight: 1.6, mt: -1 }}>
            {terms}
          </Typography>
        </MotionBox>
      </Box>
    </Box>
  )
}
