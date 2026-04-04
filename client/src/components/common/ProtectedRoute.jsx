import { Navigate, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'

function CenteredSpinner() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <CircularProgress size={32} />
    </Box>
  )
}

/**
 * Wraps a route that requires authentication.
 *
 * - While the silent refresh is in-flight (isLoading): shows a spinner.
 * - If not authenticated: redirects to /login, preserving the original URL in state.
 * - If authenticated: renders children.
 */
export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <CenteredSpinner />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
