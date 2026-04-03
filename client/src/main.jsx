import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/error/ErrorBoundary.jsx'
import './index.css'

// Theme is managed inside App.jsx so it can be toggled at runtime.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Global boundary: last resort — catches crashes in the router or providers themselves */}
    <ErrorBoundary level="app">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
