import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, useMatch, Navigate } from 'react-router-dom'
import { Box, ThemeProvider, CssBaseline } from '@mui/material'
import { buildTheme } from './theme/index.js'
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

// ─── Pages that use the full viewport height — no footer, no padding ──────────
const NO_PADDING_PAGES  = ['/']

// ─── Inner app — has access to ToastProvider + AuthContext ────────────────────
function AppInner() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const toast       = useToast()
  const { user }    = useAuth()
  const { mode: themeMode, toggle: onThemeToggle } = useContext(ColorModeContext)
  const isFullHeight = location.pathname.startsWith('/studio')
  const isNoPadding  = NO_PADDING_PAGES.includes(location.pathname)
  const isLoginPage  = location.pathname === '/login' || location.pathname === '/register'

  // ── Conversations — lifted so Sidebar and Studio share state ─────────────
  const [conversations, setConversations]             = useState([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  // activeConvId is derived directly from the URL — the URL is the single source
  // of truth. No state, no sync effects, no stale closures. This is how
  // ChatGPT (/c/:id) and Claude (/chat/:id) handle conversation routing.
  const studioMatch  = useMatch('/studio/:convId')
  const activeConvId = studioMatch?.params?.convId ?? null

  // Passed to Studio as onActiveConvIdChange. Studio calls this when a new
  // conversation is created so the URL updates to /studio/:newId.
  const onActiveConvIdChange = useCallback((id) => {
    navigate(id ? '/studio/' + id : '/studio')
  }, [navigate])

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
    navigate('/studio/' + conv.id)
  }, [navigate])

  const handleNewConversation = useCallback(() => {
    navigate('/studio')
  }, [navigate])

  // HIGH-5: All conversation mutation handlers now catch errors and surface them
  // via toast so the user gets feedback instead of silent failures.
  const handleRenameConv = useCallback(async (convId, newTitle) => {
    try {
      await api.renameConversation(convId, newTitle)
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, title: newTitle } : c)
      )
    } catch {
      toast.error('Could not rename conversation. Please try again.')
    }
  }, [toast])

  const handleStarConv = useCallback(async (convId) => {
    try {
      const result = await api.starConversation(convId)
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, starred: result.starred ? 1 : 0 } : c)
      )
    } catch {
      toast.error('Could not update conversation. Please try again.')
    }
  }, [toast])

  const handleDeleteConv = useCallback(async (convId) => {
    try {
      await api.deleteConversation(convId)
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (activeConvId === convId) {
        navigate('/studio')
      }
    } catch {
      toast.error('Could not delete conversation. Please try again.')
    }
  }, [activeConvId, navigate, toast])

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
          {/* Route-level boundary: page crashes don't take down the sidebar.
              Key stays constant within /studio/* so Studio never remounts on conv switch. */}
          <ErrorBoundary level="page" key={location.pathname.startsWith('/studio') ? '/studio' : location.pathname}>
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
                    onActiveConvIdChange={onActiveConvIdChange}
                    onConversationsRefresh={fetchConversations}
                    onRenameConv={handleRenameConv}
                    onStarConv={handleStarConv}
                    onDeleteConv={handleDeleteConv}
                  />
                </ProtectedRoute>
              } />
              <Route path="/studio/:convId" element={
                <ProtectedRoute>
                  <Studio
                    activeConvId={activeConvId}
                    activeConvTitle={conversations.find((c) => c.id === activeConvId)?.title ?? null}
                    activeConvStarred={!!(conversations.find((c) => c.id === activeConvId)?.starred)}
                    onActiveConvIdChange={onActiveConvIdChange}
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

  // Keep CSS custom properties in sync with MUI theme so non-MUI elements
  // (scrollbars, ProseMirror editor, third-party widgets) also respond to mode.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

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
