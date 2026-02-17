import { Box, Typography, Paper } from '@mui/material'

const AboutUs = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        About Us
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600 }}>
        We are Falcon — building modern solutions that empower teams to work smarter and faster.
      </Typography>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Our Mission
        </Typography>
        <Typography variant="body2" color="text.secondary">
          To deliver clean, reliable, and intuitive software that helps businesses scale
          with confidence. We believe in simplicity, transparency, and putting users first.
        </Typography>
      </Paper>
    </Box>
  )
}

export default AboutUs
