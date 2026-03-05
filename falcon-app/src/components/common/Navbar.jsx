import { AppBar, Toolbar, Typography, IconButton, Box, useTheme } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import { useColorMode } from '../../App'

const Navbar = ({ onToggleSidebar }) => {
  const theme = useTheme()
  const { mode, toggle } = useColorMode()
  const isDark = mode === 'dark'

  const borderColor = theme.palette.divider
  const iconColor   = theme.palette.text.secondary

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${borderColor}`,
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: '52px !important', px: 2, gap: 1 }}>
        {/* Sidebar toggle */}
        <IconButton
          onClick={onToggleSidebar}
          size="small"
          sx={{
            color: iconColor,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
          }}
        >
          <MenuIcon fontSize="small" />
        </IconButton>

        {/* App name */}
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 14.5,
            color: theme.palette.text.primary,
            letterSpacing: '-0.3px',
          }}
        >
          Falcon
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Theme toggle */}
        <IconButton
          onClick={toggle}
          size="small"
          sx={{
            color: iconColor,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
          }}
        >
          {isDark
            ? <LightModeOutlinedIcon fontSize="small" />
            : <DarkModeOutlinedIcon  fontSize="small" />
          }
        </IconButton>
      </Toolbar>
    </AppBar>
  )
}

export default Navbar
