import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { useNavigate, useLocation } from 'react-router-dom'

const drawerWidthOpen = 240
const drawerWidthClosed = 64

const navItems = [
  { label: 'About Us', path: '/', icon: <InfoOutlinedIcon /> },
  { label: 'Product', path: '/product', icon: <Inventory2OutlinedIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon /> },
]

const Sidebar = ({ open }) => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? drawerWidthOpen : drawerWidthClosed,
        flexShrink: 0,
        transition: 'width 0.3s',
        '& .MuiDrawer-paper': {
          width: open ? drawerWidthOpen : drawerWidthClosed,
          transition: 'width 0.3s',
          overflowX: 'hidden',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fff',
        },
      }}
    >
      <Toolbar />
      <List sx={{ mt: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <ListItem key={item.label} disablePadding sx={{ px: 1, mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: '8px',
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  backgroundColor: isActive ? 'rgba(0, 26, 255, 0.08)' : 'transparent',
                  color: isActive ? '#001AFF' : '#444',
                  '&:hover': {
                    backgroundColor: isActive
                      ? 'rgba(0, 26, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 2 : 'auto',
                    justifyContent: 'center',
                    color: isActive ? '#001AFF' : '#666',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    opacity: open ? 1 : 0,
                    transition: 'opacity 0.3s',
                    '& .MuiTypography-root': { fontSize: 14, fontWeight: isActive ? 600 : 400 },
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Drawer>
  )
}

export default Sidebar
