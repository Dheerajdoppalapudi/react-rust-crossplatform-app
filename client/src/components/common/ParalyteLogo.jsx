import { Box } from '@mui/material'

const PETALS = Array.from({ length: 12 }, (_, i) => i * 30)

export default function ParalyteLogo({ sx, ...props }) {
  return (
    <Box
      component="svg"
      viewBox="-100 -100 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      sx={{
        display: 'inline-block',
        flexShrink: 0,
        width: '1em',
        height: '1em',
        fontSize: 'inherit',
        userSelect: 'none',
        ...sx,
      }}
      {...props}
    >
      {PETALS.map((deg) => (
        <g key={deg} transform={`rotate(${deg}) translate(0 -58) scale(0.45)`}>
          <path d="M -36 -30 L 0 32 L 36 -30 L 22 -30 L 0 10 L -22 -30 Z" fill="currentColor" />
          <circle cx="0" cy="-34" r="9" fill="currentColor" />
          <path d="M -4 -24 L 4 -24 L 2 8 L -2 8 Z" fill="currentColor" />
        </g>
      ))}
      <circle cx="0" cy="0" r="14" fill="currentColor" />
      <circle cx="0" cy="0" r="28" fill="none" stroke="currentColor" strokeWidth="5" />
    </Box>
  )
}
