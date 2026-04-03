import { Box, Typography, useTheme } from '@mui/material'

const Footer = () => {
  const theme = useTheme()

  return (
    <Box
      component="footer"
      sx={{
        height: 36,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary }}>
        © {new Date().getFullYear()} Zenith
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, opacity: 0.4 }}>
        v0.1.0
      </Typography>
    </Box>
  )
}

export default Footer
