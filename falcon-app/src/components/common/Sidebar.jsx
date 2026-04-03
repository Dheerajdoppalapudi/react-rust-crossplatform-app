import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Box,
  Divider,
  useTheme,
  InputBase,
  IconButton,
} from '@mui/material'
import HomeOutlinedIcon        from '@mui/icons-material/HomeOutlined'
import SettingsOutlinedIcon    from '@mui/icons-material/SettingsOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SearchIcon              from '@mui/icons-material/Search'
import AddIcon                 from '@mui/icons-material/Add'
import DarkModeOutlinedIcon    from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon   from '@mui/icons-material/LightModeOutlined'
import AutoAwesomeIcon         from '@mui/icons-material/AutoAwesome'
import ChevronLeftIcon         from '@mui/icons-material/ChevronLeft'
import { useNavigate, useLocation } from 'react-router-dom'
import { relativeTime } from '../Studio/constants'

const DRAWER_OPEN   = 260
const DRAWER_CLOSED = 56
const ICON_SIZE     = 20   // single source of truth for all icons

const mainItems = [
  { label: 'About Us', path: '/',       icon: <HomeOutlinedIcon        sx={{ fontSize: ICON_SIZE }} /> },
  { label: 'Studio',   path: '/studio', icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: ICON_SIZE }} /> },
]

const bottomItems = [
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon sx={{ fontSize: ICON_SIZE }} /> },
]

// ── Date grouping ─────────────────────────────────────────────────────────────
function groupConversations(conversations) {
  const now  = new Date()
  const bod  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest = new Date(bod - 86_400_000)
  const week = new Date(bod - 7 * 86_400_000)

  const buckets = { Today: [], Yesterday: [], 'This week': [], Earlier: [] }
  conversations.forEach((c) => {
    const d = new Date(c.updated_at)
    if      (d >= bod)  buckets.Today.push(c)
    else if (d >= yest) buckets.Yesterday.push(c)
    else if (d >= week) buckets['This week'].push(c)
    else                buckets.Earlier.push(c)
  })
  return Object.entries(buckets).filter(([, items]) => items.length > 0)
}

// ─── Shared collapsed icon button — identical container for every icon ────────
const CollapsedBtn = ({ label, icon, onClick, isActive, accent, isDark }) => {
  const theme = useTheme()
  const activeBg = isDark ? 'rgba(79,110,255,0.12)' : 'rgba(0,26,255,0.07)'
  const hoverBg  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <Tooltip title={label} placement="right" arrow>
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          onClick={onClick}
          sx={{
            borderRadius: '8px',
            minHeight: 40,
            px: 0,
            justifyContent: 'center',
            bgcolor: isActive ? activeBg : 'transparent',
            '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
            transition: 'background 0.15s',
            mx: 0.75,
          }}
        >
          <ListItemIcon sx={{
            minWidth: 0, justifyContent: 'center',
            color: isActive ? accent : theme.palette.text.secondary,
          }}>
            {icon}
          </ListItemIcon>
        </ListItemButton>
      </ListItem>
    </Tooltip>
  )
}

// ─── Single nav item (expanded) ───────────────────────────────────────────────
const NavItem = ({ item, open, isActive, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accent = theme.palette.primary.main

  if (!open) {
    return (
      <CollapsedBtn
        label={item.label}
        icon={item.icon}
        onClick={onClick}
        isActive={isActive}
        accent={accent}
        isDark={isDark}
      />
    )
  }

  const activeBg  = isDark ? 'rgba(79,110,255,0.12)'  : 'rgba(0,26,255,0.07)'
  const hoverBg   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <ListItem disablePadding sx={{ px: 0.75, mb: 0.25 }}>
      <ListItemButton
        onClick={onClick}
        sx={{
          borderRadius: '8px', minHeight: 40, px: 1.25,
          bgcolor: isActive ? activeBg : 'transparent',
          '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
          transition: 'background 0.15s',
        }}
      >
        <ListItemIcon sx={{
          minWidth: 0, mr: 1.5, justifyContent: 'center',
          color: isActive ? accent : theme.palette.text.secondary,
          transition: 'color 0.15s',
        }}>
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          sx={{
            '& .MuiTypography-root': {
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? accent : theme.palette.text.primary,
            },
          }}
        />
        {isActive && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: accent, flexShrink: 0, ml: 0.5 }} />
        )}
      </ListItemButton>
    </ListItem>
  )
}

// ─── Single conversation row ──────────────────────────────────────────────────
const ConvItem = ({ conv, isActive, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accent = theme.palette.primary.main

  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.6, mx: 0.75, mb: 0.15,
        borderRadius: '8px', cursor: 'pointer',
        bgcolor: isActive
          ? (isDark ? 'rgba(79,110,255,0.12)' : 'rgba(0,26,255,0.07)')
          : 'transparent',
        '&:hover': {
          bgcolor: isActive
            ? (isDark ? 'rgba(79,110,255,0.15)' : 'rgba(0,26,255,0.09)')
            : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
        },
        transition: 'background 0.15s',
      }}
    >
      <Typography noWrap sx={{
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        color: isActive ? accent : theme.palette.text.primary, lineHeight: 1.4,
      }}>
        {conv.title || 'Untitled'}
      </Typography>
      <Typography sx={{ fontSize: 10.5, color: theme.palette.text.disabled, mt: 0.1 }}>
        {relativeTime(conv.updated_at)}
      </Typography>
    </Box>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({ conversations = [], activeConvId, onSelectConv, onNewConversation, themeMode, onThemeToggle }) => {
  const theme    = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark   = theme.palette.mode === 'dark'
  const accent   = theme.palette.primary.main

  const [open, setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const searchRef           = useRef(null)

  const isMac    = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const modKey   = isMac ? '⌘' : 'Ctrl+'
  const newChatShortcut = isMac ? '⇧⌘O' : 'Ctrl+Shift+O'
  const searchShortcut  = isMac ? '⌘K'  : 'Ctrl+K'

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      // New chat: ⌘⇧O / Ctrl+Shift+O
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        onNewConversation()
      }
      // Search: ⌘K / Ctrl+K
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => searchRef.current?.focus(), 150)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMac, onNewConversation])

  const sidebarBg = isDark ? '#161616' : '#fafafa'

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q))
  }, [conversations, search])

  const grouped = useMemo(() => groupConversations(filtered), [filtered])

  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
    <Drawer
      variant="permanent"
      onClick={!open ? () => setOpen(true) : undefined}
      sx={{
        cursor: !open ? 'pointer' : 'default',
        width: open ? DRAWER_OPEN : DRAWER_CLOSED,
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_OPEN : DRAWER_CLOSED,
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowX: 'hidden',
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundColor: sidebarBg,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        },
      }}
    >

      {/* ── Logo + toggle ─────────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center',
        px: 0.75, height: 52,
        borderBottom: `1px solid ${theme.palette.divider}`,
        gap: 0.5,
      }}>
        <Tooltip title={open ? 'Collapse' : 'Expand'} placement="right" arrow>
          <Box
            onClick={(e) => { e.stopPropagation(); setOpen((p) => !p) }}
            sx={{
              width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, #001AFF 0%, #6B44F8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 10px ${accent}40`,
              cursor: 'pointer',
              '&:hover': { opacity: 0.85 },
              transition: 'opacity 0.15s',
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 14, color: '#fff' }} />
          </Box>
        </Tooltip>

        {open && (
          <Typography sx={{
            fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px',
            color: theme.palette.text.primary, whiteSpace: 'nowrap', flex: 1,
          }}>
            Zenith
          </Typography>
        )}

        {open && (
          <Tooltip title="Collapse" placement="right" arrow>
            <Box
              onClick={(e) => { e.stopPropagation(); setOpen(false) }}
              sx={{
                width: 26, height: 26, borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                color: theme.palette.text.disabled,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  color: theme.palette.text.secondary,
                },
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* ── Top nav ───────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, pt: 1 }}>
        {open && (
          <Typography sx={{
            fontSize: 10, fontWeight: 600, color: theme.palette.text.secondary,
            textTransform: 'uppercase', letterSpacing: '0.8px',
            px: 2, mb: 0.75, opacity: 0.6,
          }}>
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
      </Box>

      <Divider sx={{ mx: 1, mt: 1, mb: 0, borderColor: theme.palette.divider }} />

      {/* ── New Chat row ──────────────────────────────────────────────────── */}
      {open ? (
        <ListItem disablePadding sx={{ px: 0.75, py: 0.5 }}>
          <ListItemButton
            onClick={onNewConversation}
            sx={{
              borderRadius: '8px', minHeight: 40, px: 1.25,
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
              transition: 'background 0.15s',
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: 1.5, justifyContent: 'center', color: theme.palette.text.secondary }}>
              <AddIcon sx={{ fontSize: ICON_SIZE }} />
            </ListItemIcon>
            <ListItemText
              primary="New chat"
              sx={{ '& .MuiTypography-root': { fontSize: 13.5, fontWeight: 400, color: theme.palette.text.primary } }}
            />
            <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled, opacity: 0.6, letterSpacing: '0.02em' }}>
              {newChatShortcut}
            </Typography>
          </ListItemButton>
        </ListItem>
      ) : (
        <List disablePadding>
          <CollapsedBtn
            label="New chat"
            icon={<AddIcon sx={{ fontSize: ICON_SIZE }} />}
            onClick={onNewConversation}
            isActive={false}
            accent={accent}
            isDark={isDark}
          />
        </List>
      )}

      <Divider sx={{ mx: 1, mt: 0, mb: 1, borderColor: theme.palette.divider }} />

      {/* ── Conversations section ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Expanded: header + search */}
        {open && (
          <Box sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}>
            <Box sx={{ px: 0.75, mb: 0.5 }}>
              <Typography sx={{
                fontSize: 10, fontWeight: 600, color: theme.palette.text.secondary,
                textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.6,
              }}>
                Your Chats
              </Typography>
            </Box>

            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderRadius: '8px', px: 1.25, py: 0.5, mx: 0.25,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <SearchIcon sx={{ fontSize: 14, color: theme.palette.text.disabled, flexShrink: 0 }} />
              <InputBase
                inputRef={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats…"
                sx={{
                  flex: 1,
                  '& input': {
                    fontSize: 12.5, color: theme.palette.text.primary, p: 0,
                    '&::placeholder': { color: theme.palette.text.disabled, opacity: 1 },
                  },
                }}
              />
              {!search && (
                <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled, opacity: 0.6, flexShrink: 0, letterSpacing: '0.02em' }}>
                  {searchShortcut}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Collapsed: search icon */}
        {!open && (
          <List disablePadding>
            <CollapsedBtn
              label="Search chats"
              icon={<SearchIcon sx={{ fontSize: ICON_SIZE }} />}
              onClick={null}
              isActive={false}
              accent={accent}
              isDark={isDark}
            />
          </List>
        )}

        {/* Scrollable conversation list — only when expanded */}
        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 1,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
        }}>
          {conversations.length === 0 && open && (
            <Typography sx={{
              fontSize: 12, color: theme.palette.text.secondary,
              textAlign: 'center', pt: 3, opacity: 0.45,
            }}>
              No chats yet
            </Typography>
          )}

          {open && grouped.map(([label, items]) => (
            <Box key={label}>
              <Typography sx={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                color: theme.palette.text.disabled,
                px: 2.25, pt: 1.5, pb: 0.5, textTransform: 'uppercase',
              }}>
                {label}
              </Typography>
              {items.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={activeConvId === conv.id}
                  onClick={() => onSelectConv(conv)}
                />
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Bottom: theme toggle + settings ───────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <Divider sx={{ mx: 1, mb: 1, borderColor: theme.palette.divider }} />

        {/* Theme toggle */}
        {open ? (
          <ListItem disablePadding sx={{ px: 0.75, mb: 0.25 }}>
            <ListItemButton
              onClick={onThemeToggle}
              sx={{
                borderRadius: '8px', minHeight: 40, px: 1.25,
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                transition: 'background 0.15s',
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: 1.5, justifyContent: 'center', color: theme.palette.text.secondary }}>
                {themeMode === 'dark'
                  ? <LightModeOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
                  : <DarkModeOutlinedIcon  sx={{ fontSize: ICON_SIZE }} />
                }
              </ListItemIcon>
              <ListItemText
                primary={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
                sx={{ '& .MuiTypography-root': { fontSize: 13.5, fontWeight: 400, color: theme.palette.text.primary } }}
              />
            </ListItemButton>
          </ListItem>
        ) : (
          <CollapsedBtn
            label={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
            icon={themeMode === 'dark'
              ? <LightModeOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
              : <DarkModeOutlinedIcon  sx={{ fontSize: ICON_SIZE }} />
            }
            onClick={onThemeToggle}
            isActive={false}
            accent={accent}
            isDark={isDark}
          />
        )}

        {/* Settings */}
        <List disablePadding sx={{ pb: 1 }}>
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

    </Box>
  )
}

export default Sidebar
