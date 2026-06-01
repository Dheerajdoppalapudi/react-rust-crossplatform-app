import { createTheme } from '@mui/material'
import { BRAND, PALETTE, SEMANTIC, TYPOGRAPHY, RADIUS } from './tokens.js'

export const buildTheme = (mode) => {
  const isDark = mode === 'dark'

  return createTheme({
    typography: {
      fontFamily: TYPOGRAPHY.fontFamily,
      fontWeightLight:   TYPOGRAPHY.weights.light,
      fontWeightRegular: TYPOGRAPHY.weights.regular,
      fontWeightMedium:  TYPOGRAPHY.weights.medium,
      fontWeightBold:    TYPOGRAPHY.weights.semibold,
    },

    palette: {
      mode,
      primary: {
        main:  isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
        light: PALETTE.warmSilver,
        dark:  PALETTE.nearBlackText,
      },
      background: {
        default: isDark ? PALETTE.nearBlack   : PALETTE.parchment,
        paper:   isDark ? PALETTE.darkSurface : PALETTE.ivory,
      },
      text: {
        primary:   isDark ? PALETTE.warmSilver  : PALETTE.nearBlackText,
        secondary: isDark ? PALETTE.stoneGray   : PALETTE.oliveGray,
        disabled:  isDark ? PALETTE.charcoalWarm: PALETTE.stoneGray,
      },
      divider: isDark ? PALETTE.borderDark : PALETTE.border,
      error:   { main: SEMANTIC.danger },
    },

    shape: {
      borderRadius: RADIUS.md,
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? PALETTE.nearBlack : PALETTE.parchment,
            fontFamily: TYPOGRAPHY.fontFamily,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          '::selection': {
            backgroundColor: 'rgba(14, 124, 102, 0.20)',
            color: 'inherit',
          },
          '::-moz-selection': {
            backgroundColor: 'rgba(14, 124, 102, 0.20)',
            color: 'inherit',
          },
          '::-webkit-scrollbar': { width: '3px', height: '3px' },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? PALETTE.borderDark : PALETTE.border,
            borderRadius: '2px',
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: TYPOGRAPHY.weights.medium,
            fontFamily: TYPOGRAPHY.fontFamily,
            borderRadius: RADIUS.md,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          contained: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
            color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)'}`,
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)'}`,
            },
          },
          outlined: {
            borderColor: isDark ? PALETTE.borderDark : PALETTE.border,
            color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
            '&:hover': {
              borderColor: BRAND.primary,
              color: BRAND.primary,
              background: 'transparent',
            },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.lg,
            fontFamily: TYPOGRAPHY.fontFamily,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: PALETTE.focusBlue,
            },
          },
          notchedOutline: {
            borderColor: isDark ? PALETTE.borderDark : PALETTE.border,
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            border: 'none',
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
            boxShadow: isDark ? '0px 8px 24px rgba(0,0,0,0.5)' : '0px 4px 16px rgba(0,0,0,0.08)',
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.sizes.bodySm,
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
              color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
            },
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.sizes.label,
            backgroundColor: isDark ? PALETTE.darkSubsurface : PALETTE.nearBlack,
            color: PALETTE.warmSilver,
          },
          arrow: {
            color: isDark ? PALETTE.darkSubsurface : PALETTE.nearBlack,
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? PALETTE.borderDark : PALETTE.border,
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: TYPOGRAPHY.sizes.label,
            fontWeight: TYPOGRAPHY.weights.medium,
          },
        },
      },
    },
  })
}
