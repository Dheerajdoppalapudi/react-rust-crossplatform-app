import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import ErrorBoundary from './components/error/ErrorBoundary.jsx'
import { initSentry } from './lib/sentry.js'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,  // treat data as fresh for 30s
      gcTime:         5 * 60_000,   // keep in cache 5min after last observer unmounts
      retry:                1,
      refetchOnWindowFocus: false,
    },
  },
})

// Initialise Sentry before React mounts so it instruments the full component tree.
// No-op when VITE_SENTRY_DSN is not set or when running in dev mode.
initSentry()

// M-8: Fail fast if VITE_GOOGLE_CLIENT_ID is missing — a blank string causes
// @react-oauth/google to silently fail and the user sees no Google button.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) {
  throw new Error(
    'VITE_GOOGLE_CLIENT_ID is not set. ' +
    'Add it to client/.env (dev) or GitHub secrets (CI). ' +
    'Obtain it from Google Cloud Console → Credentials → OAuth 2.0 Client IDs.'
  )
}

// Theme is managed inside App.jsx so it can be toggled at runtime.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* GoogleOAuthProvider must be outermost so @react-oauth/google hooks work everywhere */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {/* Global boundary: last resort — catches crashes in the router or providers themselves */}
      <ErrorBoundary level="app">
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </GoogleOAuthProvider>
  </StrictMode>,
)
