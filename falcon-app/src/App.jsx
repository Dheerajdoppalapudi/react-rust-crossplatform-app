import { useState, useMemo, createContext, useContext } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Box, Toolbar, ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import Navbar from './components/common/Navbar'
import Sidebar from './components/common/Sidebar'
import Footer from './components/common/Footer'
import AboutUs from './pages/AboutUs'
import Settings from './pages/Settings'
import Studio from './pages/Studio'

// ─── Theme context ────────────────────────────────────────────────────────────
export const ColorModeContext = createContext({ mode: 'light', toggle: () => {} })
export const useColorMode = () => useContext(ColorModeContext)

// ─── Theme factory ────────────────────────────────────────────────────────────
const buildTheme = (mode) =>
  createTheme({
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
          body: { backgroundColor: mode === 'dark' ? '#111111' : '#f8fafc' },
        },
      },
    },
  })

// ─── Pages that are full-height — no footer, no padding ──────────────────────
const FULL_HEIGHT_PAGES = ['/studio']

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('falcon-theme') || 'light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const isFullHeight = FULL_HEIGHT_PAGES.includes(location.pathname)

  const colorMode = useMemo(() => ({
    mode,
    toggle: () =>
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light'
        localStorage.setItem('falcon-theme', next)
        return next
      }),
  }), [mode])

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
          <Navbar onToggleSidebar={() => setSidebarOpen((p) => !p)} />
          <Sidebar open={sidebarOpen} />

          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',        // exact viewport height — prevents page-level scroll
              overflow: 'hidden',
            }}
          >
            <Toolbar sx={{ minHeight: '52px !important' }} />
            <Box
              component="main"
              sx={{
                flex: 1,
                p: isFullHeight ? 0 : 3,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: isFullHeight ? 'hidden' : 'auto',
                '& > *': { flex: 1, minHeight: 0 },
              }}
            >
              <Routes>
                <Route path="/"       element={<AboutUs />} />
                <Route path="/studio" element={<Studio />} />
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
