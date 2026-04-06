import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Box, ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import Sidebar from './components/common/Sidebar'
import Footer from './components/common/Footer'
import AboutUs from './pages/AboutUs'
import Settings from './pages/Settings'
import Studio from './pages/Studio'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedRoute from './components/common/ProtectedRoute'
import ErrorBoundary from './components/error/ErrorBoundary'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { api } from './services/api'

// ─── Theme context ────────────────────────────────────────────────────────────
export const ColorModeContext = createContext({ mode: 'light', toggle: () => {} })
export const useColorMode = () => useContext(ColorModeContext)

// ─── Theme factory ────────────────────────────────────────────────────────────
const buildTheme = (mode) =>
  createTheme({
    typography: {
      fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontWeightLight:   300,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    600,
    },
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#4F6EFF' : '#001AFF' },
      background: {
        default: mode === 'dark' ? '#111111' : '#f8fafc',
        paper:   mode === 'dark' ? '#1a1a1a' : '#ffffff',
      },
      text: {
        primary:   mode === 'dark' ? '#f1f5f9' : '#0f172a',
        secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
      },
      divider: mode === 'dark' ? '#252525' : '#f0f0f0',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: mode === 'dark' ? '#111111' : '#f8fafc',
            fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          },
        },
      },
    },
  })

// ─── Pages that use the full viewport height — no footer, no padding ──────────
const FULL_HEIGHT_PAGES = ['/studio']
const NO_PADDING_PAGES  = ['/']

// ─── Inner app — has access to ToastProvider + AuthContext ────────────────────
function AppInner() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const toast       = useToast()
  const { user }    = useAuth()
  const { mode: themeMode, toggle: onThemeToggle } = useContext(ColorModeContext)
  const isFullHeight = FULL_HEIGHT_PAGES.includes(location.pathname)
  const isNoPadding  = NO_PADDING_PAGES.includes(location.pathname)
  const isLoginPage  = location.pathname === '/login' || location.pathname === '/register'

  // ── Conversations — lifted so Sidebar and Studio share state ─────────────
  const [conversations, setConversations]             = useState([])
  const [activeConvId, setActiveConvId]               = useState(null)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([])
      setIsLoadingConversations(false)
      return
    }
    try {
      const data = await api.getConversations()
      setConversations(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load your conversations. Check your connection and try again.')
    } finally {
      setIsLoadingConversations(false)
    }
  }, [toast, user])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const handleSelectConv = useCallback((conv) => {
    setActiveConvId(conv.id)
    navigate('/studio')
  }, [navigate])

  const handleNewConversation = useCallback(() => {
    setActiveConvId(null)
    navigate('/studio')
  }, [navigate])

  const handleRenameConv = useCallback(async (convId, newTitle) => {
    await api.renameConversation(convId, newTitle)
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, title: newTitle } : c)
    )
  }, [])

  const handleStarConv = useCallback(async (convId) => {
    const result = await api.starConversation(convId)
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, starred: result.starred ? 1 : 0 } : c)
    )
  }, [])

  const handleDeleteConv = useCallback(async (convId) => {
    await api.deleteConversation(convId)
    setConversations((prev) => prev.filter((c) => c.id !== convId))
    if (activeConvId === convId) {
      setActiveConvId(null)
      navigate('/studio')
    }
  }, [activeConvId, navigate])

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>

      {/* Sidebar is hidden on the login page */}
      {!isLoginPage && (
        <Sidebar
          conversations={conversations}
          activeConvId={activeConvId}
          onSelectConv={handleSelectConv}
          onNewConversation={handleNewConversation}
          onRenameConv={handleRenameConv}
          onStarConv={handleStarConv}
          onDeleteConv={handleDeleteConv}
          themeMode={themeMode}
          onThemeToggle={onThemeToggle}
          isLoading={isLoadingConversations}
        />
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Box
          component="main"
          sx={{
            flex: 1,
            p: (isFullHeight || isNoPadding || isLoginPage) ? 0 : 3,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: (isFullHeight || isLoginPage) ? 'hidden' : 'auto',
            '& > *': { flex: 1, minHeight: 0 },
          }}
        >
          {/* Route-level boundary: page crashes don't take down the sidebar */}
          <ErrorBoundary level="page" key={location.pathname}>
            <Routes>
              {/* Always public */}
              <Route path="/"      element={<AboutUs />} />
              <Route path="/login" element={
                user ? <Navigate to="/studio" replace /> : <Login />
              } />
              <Route path="/register" element={
                user ? <Navigate to="/studio" replace /> : <Register />
              } />

              {/* Protected — require login */}
              <Route path="/studio" element={
                <ProtectedRoute>
                  <Studio
                    activeConvId={activeConvId}
                    activeConvTitle={conversations.find((c) => c.id === activeConvId)?.title ?? null}
                    activeConvStarred={!!(conversations.find((c) => c.id === activeConvId)?.starred)}
                    onActiveConvIdChange={setActiveConvId}
                    onConversationsRefresh={fetchConversations}
                    onRenameConv={handleRenameConv}
                    onStarConv={handleStarConv}
                    onDeleteConv={handleDeleteConv}
                  />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
            </Routes>
          </ErrorBoundary>
        </Box>

        {!isFullHeight && !isLoginPage && <Footer />}
      </Box>

    </Box>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem('zenith-theme')
    return stored === 'light' || stored === 'dark' ? stored : 'light'
  })

  const colorMode = useMemo(() => ({
    mode,
    toggle: () =>
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light'
        localStorage.setItem('zenith-theme', next)
        return next
      }),
  }), [mode])

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export default App
