import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Box, Toolbar } from '@mui/material'
import Navbar from './components/common/Navbar'
import Sidebar from './components/common/Sidebar'
import Footer from './components/common/Footer'
import AboutUs from './pages/AboutUs'
import Product from './pages/Product'
import Settings from './pages/Settings'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const isChatPage = location.pathname === '/product'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <Sidebar open={sidebarOpen} />
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <Box
          component="main"
          sx={{
            flex: 1,
            p: isChatPage ? 0 : 3,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: isChatPage ? 'hidden' : 'auto',
            '& > *': { flex: 1, minHeight: 0 },
          }}
        >
          <Routes>
            <Route path="/" element={<AboutUs />} />
            <Route path="/product" element={<Product />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Box>
        {!isChatPage && <Footer />}
      </Box>
    </Box>
  )
}

export default App
