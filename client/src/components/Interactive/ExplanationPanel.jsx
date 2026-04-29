import { Box, Typography } from '@mui/material'

export default function ExplanationPanel({ title, text }) {
  if (!text) return null

  return (
    <Box sx={{ mb: 2 }}>
      {title && (
        <Typography
          variant="h6"
          sx={{ fontSize: 16, fontWeight: 600, mb: 1, color: 'text.primary', lineHeight: 1.3 }}
        >
          {title}
        </Typography>
      )}

      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary', lineHeight: 1.75, fontSize: 14,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </Typography>
    </Box>
  )
}
