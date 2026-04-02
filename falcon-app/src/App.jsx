import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Box, ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import Sidebar from './components/common/Sidebar'
import Footer from './components/common/Footer'
import AboutUs from './pages/AboutUs'
import Settings from './pages/Settings'
import Studio from './pages/Studio'
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

// ─── Pages that are full-height — no footer, no padding ──────────────────────
const FULL_HEIGHT_PAGES = ['/studio']

// ─── Pages that are edge-to-edge — no outer padding, keep footer ─────────────
const NO_PADDING_PAGES  = ['/']

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('zenith-theme') || 'light')
  const location  = useLocation()
  const navigate  = useNavigate()
  const isFullHeight = FULL_HEIGHT_PAGES.includes(location.pathname)
  const isNoPadding  = NO_PADDING_PAGES.includes(location.pathname)

  // ── Conversations — lifted so Sidebar and Studio share them ──────────────
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId]   = useState(null)

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations()
      setConversations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[App] fetchConversations:', err)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const handleSelectConv = useCallback((conv) => {
    setActiveConvId(conv.id)
    navigate('/studio')
  }, [navigate])

  const handleNewConversation = useCallback(() => {
    setActiveConvId(null)
    navigate('/studio')
  }, [navigate])

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
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>

          <Sidebar
            conversations={conversations}
            activeConvId={activeConvId}
            onSelectConv={handleSelectConv}
            onNewConversation={handleNewConversation}
            themeMode={mode}
            onThemeToggle={colorMode.toggle}
          />

          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <Box
              component="main"
              sx={{
                flex: 1,
                p: (isFullHeight || isNoPadding) ? 0 : 3,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: isFullHeight ? 'hidden' : 'auto',
                '& > *': { flex: 1, minHeight: 0 },
              }}
            >
              <Routes>
                <Route path="/"         element={<AboutUs />} />
                <Route path="/studio"   element={
                  <Studio
                    activeConvId={activeConvId}
                    onActiveConvIdChange={setActiveConvId}
                    onConversationsRefresh={fetchConversations}
                  />
                } />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Box>

            {!isFullHeight && <Footer />}
          </Box>

        </Box>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export default App
