import { keyframes } from '@mui/material'

export const pulse      = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0.4; }`
export const softPulse  = keyframes`0%, 100% { opacity: 0.88; } 50% { opacity: 0.28; }`
export const fadeIn     = keyframes`from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }`
export const shimmer    = keyframes`0% { transform: translateX(-100%); } 100% { transform: translateX(100%); }`
export const blink      = keyframes`0%, 100% { opacity: 0; } 50% { opacity: 0.35; }`
