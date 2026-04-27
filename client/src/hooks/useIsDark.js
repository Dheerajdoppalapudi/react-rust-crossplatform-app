import { useTheme } from '@mui/material'

export function useIsDark() {
  return useTheme().palette.mode === 'dark'
}
