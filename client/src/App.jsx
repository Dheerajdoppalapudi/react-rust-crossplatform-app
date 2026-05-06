import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, useMatch, Navigate } from 'react-router-dom'
import { Box, ThemeProvider, CssBaseline, IconButton, Typography, useTheme, useMediaQuery } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { buildTheme } from './theme/index.js'
import Sidebar from './components/common/Sidebar'
import Footer from './components/common/Footer'
import { BRAND } from './theme/tokens.js'
import { STORAGE_KEYS, VALID_THEMES } from './constants/storage.js'
import { ROUTES, studioConvUrl } from './constants/routes.js'
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

// ─── Mobile header toolbar slot ───────────────────────────────────────────────
// Studio fills this slot on mobile so its controls appear in the header bar.
export const MobileHeaderSlotContext = createContext({ setSlot: () => {} })
export const useMobileHeaderSlot = () => useContext(MobileHeaderSlotContext)

// ─── Pages that use the full viewport height — no footer, no padding ──────────
const NO_PADDING_PAGES  = ['/']

// ─── Mobile top bar ───────────────────────────────────────────────────────────
function MobileHeader({ onOpenSidebar, onNewConversation, slot }) {
  const theme = useTheme()
  return (
    <Box sx={{
      height: 48, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      px: 0.5,
      borderBottom: `1px solid ${theme.palette.divider}`,
      bgcolor: 'background.paper',
      zIndex: 10,
    }}>
      <IconButton size="small" aria-label="Open navigation" onClick={onOpenSidebar} sx={{ p: 1, flexShrink: 0 }}>
        <MenuIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
      </IconButton>

      {/* Toolbar slot — Studio fills this when on mobile */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {slot}
      </Box>

      <IconButton size="small" aria-label="New conversation" onClick={onNewConversation} sx={{ p: 1, flexShrink: 0 }}>
        <AddIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
      </IconButton>
    </Box>
  )
}

// ─── Inner app — has access to ToastProvider + AuthContext ────────────────────
function AppInner() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const toast       = useToast()
  const { user }    = useAuth()
  const { mode: themeMode, toggle: onThemeToggle } = useContext(ColorModeContext)
  const theme       = useTheme()
  const isMobile    = useMediaQuery(theme.breakpoints.down('sm'))
  const isFullHeight = location.pathname.startsWith(ROUTES.STUDIO)
  const isNoPadding  = NO_PADDING_PAGES.includes(location.pathname)
  const isLoginPage  = location.pathname === ROUTES.LOGIN || location.pathname === ROUTES.REGISTER

  // Update document title on navigation so screen readers announce the new page.
  useEffect(() => {
    const PAGE_TITLES = {
      [ROUTES.HOME]:     'Home',
      [ROUTES.LOGIN]:    'Sign in',
      [ROUTES.REGISTER]: 'Create account',
      [ROUTES.SETTINGS]: 'Settings',
    }
    const base = location.pathname.startsWith(ROUTES.STUDIO) ? 'Studio' : (PAGE_TITLES[location.pathname] ?? 'Page')
    document.title = `${base} — Zenith`
  }, [location.pathname])

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileHeaderSlot, setMobileHeaderSlot] = useState(null)
  const slotCtx = useMemo(() => ({ setSlot: setMobileHeaderSlot }), [])

  // ── Conversations — lifted so Sidebar and Studio share state ─────────────
  const [conversations, setConversations]             = useState([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  // activeConvId is derived directly from the URL — the URL is the single source
  // of truth. No state, no sync effects, no stale closures. This is how
  // ChatGPT (/c/:id) and Claude (/chat/:id) handle conversation routing.
  const studioMatch  = useMatch(ROUTES.STUDIO_CONV)
  const activeConvId = studioMatch?.params?.convId ?? null

  // Passed to Studio as onActiveConvIdChange. Studio calls this when a new
  // conversation is created so the URL updates to /studio/:newId.
  const onActiveConvIdChange = useCallback((id) => {
    navigate(id ? studioConvUrl(id) : ROUTES.STUDIO)
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
    navigate(studioConvUrl(conv.id))
  }, [navigate])

  const handleNewConversation = useCallback(() => {
    navigate(ROUTES.STUDIO)
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
        navigate(ROUTES.STUDIO)
      }
    } catch {
      toast.error('Could not delete conversation. Please try again.')
    }
  }, [activeConvId, navigate, toast])

  return (
    <MobileHeaderSlotContext.Provider value={slotCtx}>
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
            mobileOpen={mobileDrawerOpen}
            onMobileClose={() => setMobileDrawerOpen(false)}
          />
        )}

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          {/* Mobile top bar — shown only on small screens, not on login/register */}
          {!isLoginPage && isMobile && (
            <MobileHeader
              onOpenSidebar={() => setMobileDrawerOpen(true)}
              onNewConversation={handleNewConversation}
              slot={mobileHeaderSlot}
            />
          )}
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
            <ErrorBoundary level="page" key={location.pathname.startsWith(ROUTES.STUDIO) ? ROUTES.STUDIO : location.pathname}>
              <Routes>
                {/* Always public */}
                <Route path={ROUTES.HOME}     element={<AboutUs />} />
                <Route path={ROUTES.LOGIN}    element={
                  user ? <Navigate to={ROUTES.STUDIO} replace /> : <Login />
                } />
                <Route path={ROUTES.REGISTER} element={
                  user ? <Navigate to={ROUTES.STUDIO} replace /> : <Register />
                } />

                {/* Protected — require login */}
                <Route path={ROUTES.STUDIO} element={
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
                <Route path={ROUTES.STUDIO_CONV} element={
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
                <Route path={ROUTES.SETTINGS} element={
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
    </MobileHeaderSlotContext.Provider>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME)
    return VALID_THEMES.has(stored) ? stored : 'light'
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
        localStorage.setItem(STORAGE_KEYS.THEME, next)
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
