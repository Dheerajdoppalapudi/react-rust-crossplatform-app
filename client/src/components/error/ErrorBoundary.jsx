import { Component } from 'react'
import { Box, Typography, Button, useTheme } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import { BRAND, PALETTE } from '../../theme/tokens.js'

// ─── Fallback UIs ──────────────────────────────────────────────────────────────

/**
 * Full-screen fallback — used at the app root.
 * Shows a branded, centered error page with a hard reload button.
 */
function AppFallback({ onReset }) {
  return (
    <Box sx={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2.5, px: 3, bgcolor: PALETTE.nearBlack,
    }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: '14px',
        background: BRAND.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ErrorOutlineIcon sx={{ fontSize: 26, color: '#fff' }} />
      </Box>
      <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 18, color: PALETTE.warmSilver, mb: 0.75 }}>
          Something went wrong
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: PALETTE.stoneGray, lineHeight: 1.65 }}>
          An unexpected error occurred. Refreshing the page usually fixes this.
        </Typography>
      </Box>
      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={() => window.location.reload()}
        sx={{
          color: PALETTE.warmSilver, borderColor: PALETTE.borderDark,
          borderRadius: '8px', textTransform: 'none', fontWeight: 600,
          '&:hover': { borderColor: BRAND.accent, color: BRAND.accent },
        }}
      >
        Reload page
      </Button>
    </Box>
  )
}

/**
 * Page-level fallback — used per-route inside the app shell.
 * Sidebar stays visible; only the content area shows the error.
 */
function PageFallback({ onReset }) {
  return (
    <Box sx={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2, px: 3,
    }}>
      <ErrorOutlineIcon sx={{ fontSize: 36, color: 'text.secondary', opacity: 0.45 }} />
      <Box sx={{ textAlign: 'center', maxWidth: 320 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary', mb: 0.5 }}>
          This page ran into a problem
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.6 }}>
          We hit an unexpected error. You can try reloading, or go back and try again.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {onReset && (
          <Button
            size="small"
            variant="outlined"
            onClick={onReset}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Try again
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={() => window.location.reload()}
          sx={{ textTransform: 'none', borderRadius: '8px' }}
        >
          Reload
        </Button>
      </Box>
    </Box>
  )
}

/**
 * Component-level fallback — used inside content areas (e.g. per conversation turn).
 * Minimal, inline, non-blocking.
 */
function ComponentFallback({ onReset }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 2, px: 2.5, borderRadius: '10px',
      border: '1px dashed',
      borderColor: 'divider',
    }}>
      <ErrorOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.5, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>
        This section failed to load.
      </Typography>
      {onReset && (
        <Button
          size="small"
          onClick={onReset}
          sx={{ textTransform: 'none', fontSize: 12, borderRadius: '6px', flexShrink: 0 }}
        >
          Retry
        </Button>
      )}
    </Box>
  )
}

const FALLBACK_BY_LEVEL = {
  app:       AppFallback,
  page:      PageFallback,
  component: ComponentFallback,
}

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────

/**
 * Reusable React error boundary.
 *
 * Props:
 *   level      — 'app' | 'page' | 'component'  (default: 'page')
 *   fallback   — optional render prop ({ error, reset }) => ReactNode
 *                or a static ReactNode; overrides the default level fallback
 *   onReset    — called when user clicks "Try again"
 *   children   — the subtree to protect
 *
 * Usage:
 *   <ErrorBoundary level="component">
 *     <SomeFlakeyComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // HIGH-6: Forward to Sentry in production for alerting and root-cause analysis.
    // Install: npm install @sentry/react
    // Configure DSN in client/.env: VITE_SENTRY_DSN=https://...
    // Then: import * as Sentry from '@sentry/react' + Sentry.init({ dsn: ... }) in main.jsx
    if (import.meta.env.PROD && typeof window.__SENTRY__ !== 'undefined') {
      window.__SENTRY__.captureException(error, {
        contexts: { react: { componentStack: info.componentStack } },
        tags:     { errorBoundaryLevel: this.props.level ?? 'page' },
      })
    }
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { fallback, level = 'page' } = this.props

    // Render prop: <ErrorBoundary fallback={({ error, reset }) => <MyFallback />} />
    if (typeof fallback === 'function') {
      return fallback({ error: this.state.error, reset: this.handleReset })
    }

    // Static node: <ErrorBoundary fallback={<MyFallback />} />
    if (fallback) return fallback

    // Default level-appropriate fallback
    const Fallback = FALLBACK_BY_LEVEL[level] ?? PageFallback
    return <Fallback onReset={this.handleReset} />
  }
}
