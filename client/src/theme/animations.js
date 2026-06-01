import { keyframes } from '@mui/material'

export const pulse       = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0.4; }`
export const softPulse   = keyframes`0%, 100% { opacity: 0.88; } 50% { opacity: 0.28; }`
export const fadeIn      = keyframes`from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }`
export const fadeOut     = keyframes`from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(4px); }`
export const shimmer     = keyframes`0% { transform: translateX(-100%); } 100% { transform: translateX(100%); }`
export const blink       = keyframes`0%, 100% { opacity: 0; } 50% { opacity: 0.35; }`
// Sweeps a bright band left→right through text via background-clip:text
export const textShimmer = keyframes`0% { background-position: 100% center; } 100% { background-position: 0% center; }`
// Full rotation — used by spinner loader
export const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`
// Bouncing dot — stagger across 3 dots for typing-indicator effect
export const dotBounce = keyframes`0%, 80%, 100% { transform: translateY(0); opacity: 0.7; } 40% { transform: translateY(-5px); opacity: 1; }`
// Pulsed spin — spins for 1s then holds for 0.5s, repeat (total cycle 1.5s)
export const paralyteSpin = keyframes`
  0%      { transform: rotate(0deg); }
  66.67%  { transform: rotate(360deg); }
  100%    { transform: rotate(360deg); }
`
// Sweeps a light band across a skeleton/shimmer element (background-position based)
export const thumbShimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`
// Same sweep — named separately so imports are self-documenting at call sites
export const slideShimmer = thumbShimmer
// Fade-in-up for staggered list items (e.g. follow-up suggestions)
export const chipFadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`
// Cursor blink for streaming text — step-end keeps it sharp (not cross-fade)
export const cursorBlink = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0; }`
