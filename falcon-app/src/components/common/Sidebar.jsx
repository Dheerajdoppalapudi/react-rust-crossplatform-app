import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  Box,
  Divider,
  useTheme,
} from '@mui/material'
import InfoOutlinedIcon        from '@mui/icons-material/InfoOutlined'
import Inventory2OutlinedIcon  from '@mui/icons-material/Inventory2Outlined'
import SettingsOutlinedIcon    from '@mui/icons-material/SettingsOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { useNavigate, useLocation } from 'react-router-dom'

const DRAWER_OPEN   = 228
const DRAWER_CLOSED = 56

const mainItems = [
  { label: 'Product', path: '/product', icon: <Inventory2OutlinedIcon  fontSize="small" /> },
  { label: 'Studio',  path: '/studio',  icon: <AutoAwesomeOutlinedIcon fontSize="small" /> },
]

const bottomItems = [
  { label: 'About',    path: '/',         icon: <InfoOutlinedIcon     fontSize="small" /> },
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
]

// ─── Single nav item ──────────────────────────────────────────────────────────
const NavItem = ({ item, open, isActive, onClick }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const activeText = theme.palette.primary.main
  const activeBg   = isDark ? 'rgba(79,110,255,0.12)'   : 'rgba(0,26,255,0.07)'
  const hoverBg    = isDark ? 'rgba(255,255,255,0.05)'  : 'rgba(0,0,0,0.04)'
  const iconColor  = isActive ? activeText : theme.palette.text.secondary

  return (
    <Tooltip title={!open ? item.label : ''} placement="right" arrow>
      <ListItem disablePadding sx={{ px: 0.75, mb: 0.25 }}>
        <ListItemButton
          onClick={onClick}
          sx={{
            borderRadius: '8px',
            minHeight: 40,
            px: 1.25,
            justifyContent: open ? 'initial' : 'center',
            backgroundColor: isActive ? activeBg : 'transparent',
            '&:hover': { backgroundColor: isActive ? activeBg : hoverBg },
            transition: 'background 0.15s',
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: open ? 1.5 : 'auto',
              justifyContent: 'center',
              color: iconColor,
              transition: 'color 0.15s',
            }}
          >
            {item.icon}
          </ListItemIcon>

          <ListItemText
            primary={item.label}
            sx={{
              opacity: open ? 1 : 0,
              transition: 'opacity 0.2s',
              '& .MuiTypography-root': {
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? activeText : theme.palette.text.primary,
              },
            }}
          />

          {/* Active dot */}
          {isActive && open && (
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: activeText,
                flexShrink: 0,
                ml: 0.5,
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({ open }) => {
  const theme    = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark   = theme.palette.mode === 'dark'

  // Sidebar gets a slightly different bg than the main content
  const sidebarBg = isDark ? '#161616' : '#fafafa'

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_OPEN : DRAWER_CLOSED,
        flexShrink: 0,
        transition: 'width 0.25s ease',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_OPEN : DRAWER_CLOSED,
          transition: 'width 0.25s ease',
          overflowX: 'hidden',
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundColor: sidebarBg,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar sx={{ minHeight: '52px !important' }} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 1 }}>
        {/* Section label */}
        {open && (
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 600,
              color: theme.palette.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              px: 2,
              mb: 0.75,
              opacity: 0.6,
            }}
          >
            Workspace
          </Typography>
        )}

        <List disablePadding>
          {mainItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              open={open}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </List>

        <Box sx={{ flex: 1 }} />

        <Divider sx={{ mx: 1, mb: 1, borderColor: theme.palette.divider }} />

        <List disablePadding>
          {bottomItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              open={open}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </List>
      </Box>
    </Drawer>
  )
}

export default Sidebar
