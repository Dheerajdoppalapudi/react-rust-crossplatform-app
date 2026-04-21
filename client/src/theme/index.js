import { createTheme } from '@mui/material'
import { BRAND, PALETTE, TYPOGRAPHY, RADIUS } from './tokens.js'

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
        main:  isDark ? BRAND.accent   : BRAND.primary,
        light: BRAND.accent,
        dark:  BRAND.primary,
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
      divider: isDark ? PALETTE.dividerDark : PALETTE.dividerLight,
      error:   { main: PALETTE.errorRed },
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
            backgroundColor: 'rgba(24, 71, 214, 0.20)',
            color: 'inherit',
          },
          '::-moz-selection': {
            backgroundColor: 'rgba(24, 71, 214, 0.20)',
            color: 'inherit',
          },
          '::-webkit-scrollbar': { width: '3px', height: '3px' },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? PALETTE.borderDark : PALETTE.borderWarm,
            borderRadius: '2px',
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
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
            background: BRAND.gradient,
            color: PALETTE.ivory,
            '&:hover': {
              background: BRAND.gradientHover,
            },
          },
          outlined: {
            borderColor: isDark ? PALETTE.borderDark : PALETTE.borderWarm,
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
            borderColor: isDark ? PALETTE.borderDark : PALETTE.borderWarm,
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
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
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
              backgroundColor: isDark
                ? `rgba(75, 114, 255, 0.10)`
                : `rgba(24, 71, 214, 0.06)`,
            },
            '&.Mui-selected': {
              backgroundColor: isDark
                ? `rgba(75, 114, 255, 0.15)`
                : `rgba(24, 71, 214, 0.08)`,
              color: isDark ? BRAND.accent : BRAND.primary,
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
            borderColor: isDark ? PALETTE.dividerDark : PALETTE.dividerLight,
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
            border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
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
