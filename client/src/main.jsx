import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import ErrorBoundary from './components/error/ErrorBoundary.jsx'
import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Theme is managed inside App.jsx so it can be toggled at runtime.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* GoogleOAuthProvider must be outermost so @react-oauth/google hooks work everywhere */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {/* Global boundary: last resort — catches crashes in the router or providers themselves */}
      <ErrorBoundary level="app">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </GoogleOAuthProvider>
  </StrictMode>,
)
