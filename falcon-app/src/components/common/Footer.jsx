import { Box, Typography } from '@mui/material'

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 0.5,
        px: 3,
        textAlign: 'center',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#fff',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        &copy; {new Date().getFullYear()} Falcon. All rights reserved.
      </Typography>
    </Box>
  )
}

export default Footer
