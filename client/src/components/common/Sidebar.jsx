import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Typography, Box, Divider, useTheme, useMediaQuery, InputBase, IconButton,
  Skeleton, Avatar, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField,
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
import ChevronRightIcon        from '@mui/icons-material/ChevronRight'
import LogoutOutlinedIcon      from '@mui/icons-material/LogoutOutlined'
import MoreHorizIcon           from '@mui/icons-material/MoreHoriz'
import StarOutlineIcon         from '@mui/icons-material/StarOutline'
import StarIcon                from '@mui/icons-material/Star'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DeleteOutlineIcon       from '@mui/icons-material/DeleteOutline'
import { useNavigate, useLocation } from 'react-router-dom'
import { relativeTime } from '../Studio/constants'
import { useAuth } from '../../contexts/AuthContext'
import { BRAND, PALETTE } from '../../theme/tokens.js'

const DRAWER_OPEN   = 260
const DRAWER_CLOSED = 56
const ICON_SIZE     = 17

const mainItems = [
  { label: 'About Us', path: '/',       icon: <HomeOutlinedIcon        sx={{ fontSize: ICON_SIZE }} /> },
  { label: 'Studio',   path: '/studio', icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: ICON_SIZE }} /> },
]
const bottomItems = [
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon sx={{ fontSize: ICON_SIZE }} /> },
]

// ─── Date grouping ─────────────────────────────────────────────────────────────
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

// ─── Logo / collapse toggle (owns its own hover state so Sidebar never re-renders on hover) ──
const LogoButton = ({ open, accent, onToggle }) => {
  const theme   = useTheme()
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip title={open ? 'Collapse' : 'Expand'} placement="right" arrow>
      <Box
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
          background: (!open && hovered) ? 'transparent' : BRAND.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: (!open && hovered) ? 'none' : `0 2px 10px ${accent}40`,
          cursor: 'pointer',
          transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s',
          '&:hover': { opacity: (!open && hovered) ? 1 : 0.85 },
        }}
      >
        {(!open && hovered)
          ? <ChevronRightIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
          : <AutoAwesomeIcon  sx={{ fontSize: 14, color: '#fff' }} />
        }
      </Box>
    </Tooltip>
  )
}

// ─── Collapsed icon button ────────────────────────────────────────────────────
const CollapsedBtn = ({ label, icon, onClick, isActive, accent, isDark }) => {
  const theme    = useTheme()
  const activeBg = isDark ? 'rgba(75,114,255,0.12)' : 'rgba(24,71,214,0.07)'
  const hoverBg  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <Tooltip title={label} placement="right" arrow>
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          onClick={onClick}
          sx={{
            borderRadius: '7px', minHeight: 34, px: 0,
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

// ─── Single nav item ──────────────────────────────────────────────────────────
const NavItem = ({ item, open, isActive, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accent = theme.palette.primary.main

  if (!open) {
    return (
      <CollapsedBtn
        label={item.label} icon={item.icon}
        onClick={onClick} isActive={isActive}
        accent={accent} isDark={isDark}
      />
    )
  }

  const activeBg = isDark ? 'rgba(79,110,255,0.12)'  : 'rgba(0,26,255,0.07)'
  const hoverBg  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <ListItem disablePadding sx={{ px: 0.75, mb: 0.15 }}>
      <ListItemButton
        onClick={onClick}
        sx={{
          borderRadius: '7px', minHeight: 34, px: 1,
          bgcolor: isActive ? activeBg : 'transparent',
          '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
          transition: 'background 0.15s',
        }}
      >
        <ListItemIcon sx={{
          minWidth: 0, mr: 1.25, justifyContent: 'center',
          color: isActive ? accent : theme.palette.text.secondary,
        }}>
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          sx={{
            '& .MuiTypography-root': {
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? accent : theme.palette.text.primary,
            },
          }}
        />
        {isActive && (
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: accent, flexShrink: 0, ml: 0.5 }} />
        )}
      </ListItemButton>
    </ListItem>
  )
}

// ─── Single conversation row ───────────────────────────────────────────────────
const ConvItem = memo(({ conv, isActive, onSelect, onRename, onStar, onDelete }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accent = theme.palette.primary.main
  const [hovered, setHovered]       = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)

  const openMenu  = (e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget) }
  const closeMenu = ()  => setMenuAnchor(null)

  const handleStar = (e) => {
    e.stopPropagation()
    closeMenu()
    onStar(conv.id)
  }
  const handleRename = (e) => {
    e.stopPropagation()
    closeMenu()
    onRename(conv)
  }
  const handleDelete = (e) => {
    e.stopPropagation()
    closeMenu()
    onDelete(conv.id)
  }

  return (
    <>
      <Box
        onClick={() => onSelect(conv)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          px: 1.25, py: 0.4, mx: 0.75, mb: 0.1,
          borderRadius: '8px', cursor: 'pointer',
          bgcolor: isActive
            ? (isDark ? 'rgba(75,114,255,0.12)' : 'rgba(24,71,214,0.07)')
            : 'transparent',
          '&:hover': {
            bgcolor: isActive
              ? (isDark ? 'rgba(75,114,255,0.15)' : 'rgba(24,71,214,0.09)')
              : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
          },
          transition: 'background 0.15s',
          display: 'flex', alignItems: 'center', gap: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{
            fontSize: 12.5, fontWeight: isActive ? 500 : 400,
            color: isActive ? accent : theme.palette.text.primary, lineHeight: 1.4,
          }}>
            {conv.title || 'Untitled'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled, mt: 0.1, opacity: 0.7 }}>
            {relativeTime(conv.updated_at)}
          </Typography>
        </Box>

        {/* Three-dot menu button — visible on hover */}
        {(hovered || menuAnchor) && (
          <IconButton
            size="small"
            aria-label="Conversation options"
            onClick={openMenu}
            sx={{
              p: 0.3, flexShrink: 0,
              color: theme.palette.text.disabled,
              borderRadius: '5px',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                color: theme.palette.text.secondary,
              },
            }}
          >
            <MoreHorizIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        elevation={0}
        slotProps={{
          paper: {
            sx: {
              minWidth: 160,
              bgcolor: isDark ? PALETTE.sidebarDark : PALETTE.ivory,
              backgroundImage: 'none',
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: isDark
                ? '0 8px 24px rgba(0,0,0,0.6)'
                : '0 8px 24px rgba(0,0,0,0.1)',
              borderRadius: '10px',
              py: 0.5,
            },
          },
        }}
      >
        <MenuItem onClick={handleStar} sx={menuItemSx(isDark, false)}>
          {!!conv.starred
            ? <><StarIcon sx={{ fontSize: 15, color: PALETTE.starGold }} /> Unstar</>
            : <><StarOutlineIcon sx={{ fontSize: 15 }} /> Star</>
          }
        </MenuItem>
        <MenuItem onClick={handleRename} sx={menuItemSx(isDark, false)}>
          <DriveFileRenameOutlineIcon sx={{ fontSize: 15 }} /> Rename
        </MenuItem>
        <Divider sx={{ my: 0.4, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
        <MenuItem onClick={handleDelete} sx={menuItemSx(isDark, true)}>
          <DeleteOutlineIcon sx={{ fontSize: 15 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  )
})

function menuItemSx(isDark, danger) {
  return {
    fontSize: 13, gap: 1.25, px: 1.5, py: 0.75, borderRadius: '6px', mx: 0.5,
    color: danger ? PALETTE.errorRed : (isDark ? PALETTE.warmSilver : PALETTE.nearBlackText),
    '&:hover': {
      bgcolor: danger
        ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)')
        : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
    },
  }
}

// ─── Conversation list skeleton ───────────────────────────────────────────────
function ConvSkeletons() {
  return (
    <Box sx={{ px: 1.5, pt: 0.5 }}>
      {[80, 120, 95, 110, 70].map((w, i) => (
        <Box key={i} sx={{ py: 0.6, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Skeleton variant="text" width={`${w}%`} height={14} sx={{ borderRadius: '4px' }} />
          <Skeleton variant="text" width="40%"    height={11} sx={{ borderRadius: '4px' }} />
        </Box>
      ))}
    </Box>
  )
}

// ─── Rename dialog ────────────────────────────────────────────────────────────
function RenameDialog({ conv, onClose, onConfirm }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [value, setValue] = useState(conv?.title ?? '')

  useEffect(() => { setValue(conv?.title ?? '') }, [conv])

  const submit = () => {
    if (value.trim()) { onConfirm(conv.id, value.trim()); onClose() }
  }

  return (
    <Dialog
      open={Boolean(conv)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
          border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
          borderRadius: '14px',
          boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.6)' : '0 24px 60px rgba(0,0,0,0.15)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5, fontWeight: 700, fontSize: 16 }}>Rename chat</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: 14,
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500 }}
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          size="small"
          disabled={!value.trim()}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <Typography sx={{
      fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em',
      color: 'text.disabled', opacity: 0.7,
      px: 2, pt: 1.25, pb: 0.4, textTransform: 'uppercase',
    }}>
      {children}
    </Typography>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({
  conversations = [],
  activeConvId,
  onSelectConv,
  onNewConversation,
  onRenameConv,
  onStarConv,
  onDeleteConv,
  themeMode,
  onThemeToggle,
  isLoading = false,
  mobileOpen = false,
  onMobileClose,
}) => {
  const theme    = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark   = theme.palette.mode === 'dark'
  const accent   = theme.palette.primary.main
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user, logout } = useAuth()

  const [open, setOpen]           = useState(false)
  const [search, setSearch]       = useState('')
  const [renamingConv, setRenamingConv]     = useState(null)
  const searchRef = useRef(null)

  const toggleOpen = useCallback(() => setOpen(p => !p), [])

  // On mobile the drawer is controlled by parent; on desktop it's self-managed.
  const drawerOpen   = isMobile ? mobileOpen : open
  const closeMobile  = useCallback(() => onMobileClose?.(), [onMobileClose])

  const isMac           = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const newChatShortcut = isMac ? '⇧⌘O' : 'Ctrl+Shift+O'
  const searchShortcut  = isMac ? '⌘K'  : 'Ctrl+K'

  const sidebarBg = isDark ? PALETTE.sidebarDark : PALETTE.sidebarLight

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        onNewConversation()
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => searchRef.current?.focus(), 150)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMac, onNewConversation])

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q))
  }, [conversations, search])

  const starred    = useMemo(() => filtered.filter((c) => c.starred), [filtered])
  const unstarred  = useMemo(() => filtered.filter((c) => !c.starred), [filtered])
  const grouped    = useMemo(() => groupConversations(unstarred), [unstarred])
  const resultCount  = filtered.length
  const isSearching  = search.trim().length > 0

  const convItemProps = (conv) => ({
    conv,
    isActive: activeConvId === conv.id,
    onSelect: onSelectConv,
    onStar: onStarConv,
    onRename: setRenamingConv,
    onDelete: onDeleteConv,
  })

  return (
    <Box sx={{ position: 'relative', flexShrink: isMobile ? 0 : 0, width: isMobile ? 0 : undefined }}>
      <Drawer
        component="nav"
        aria-label="Main navigation"
        variant={isMobile ? 'temporary' : 'permanent'}
        open={drawerOpen}
        onClose={isMobile ? closeMobile : undefined}
        onClick={(!isMobile && !open) ? () => setOpen(true) : undefined}
        ModalProps={isMobile ? { keepMounted: true } : undefined}
        sx={{
          cursor: (!isMobile && !open) ? 'pointer' : 'default',
          width: isMobile ? 0 : (open ? DRAWER_OPEN : DRAWER_CLOSED),
          flexShrink: 0,
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          '& .MuiDrawer-paper': {
            width: DRAWER_OPEN,
            transition: isMobile ? 'none' : 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
            overflowX: 'hidden',
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: sidebarBg,
            boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
            height: '100vh',
            ...(!isMobile && { width: open ? DRAWER_OPEN : DRAWER_CLOSED }),
          },
        }}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <Box sx={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: (isMobile || open) ? 'flex-start' : 'center',
          px: (isMobile || open) ? 0.75 : 0, height: 46,
          borderBottom: `1px solid ${theme.palette.divider}`,
          gap: 0.5,
          margin: '6px',
        }}>
          {!isMobile && <LogoButton open={open} accent={accent} onToggle={toggleOpen} />}
          {isMobile && (
            <Box sx={{
              width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
              background: BRAND.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoAwesomeIcon sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}

          {(isMobile || open) && (
            <Typography sx={{
              fontWeight: 600, fontSize: 26, letterSpacing: '-0.2px', marginLeft:'4px',
              color: theme.palette.text.primary, whiteSpace: 'nowrap', flex: 1,
            }}>
              Zenith
            </Typography>
          )}

          {(isMobile || open) && (
            <IconButton
              size="small"
              aria-label="Close sidebar"
              onClick={(e) => { e.stopPropagation(); isMobile ? closeMobile() : setOpen(false) }}
              sx={{
                width: 26, height: 26, borderRadius: '6px', flexShrink: 0,
                color: theme.palette.text.disabled,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  color: theme.palette.text.secondary,
                },
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>

        {/* ── Top nav ─────────────────────────────────────────────────────── */}
        <Box sx={{ flexShrink: 0, pt: 1 }}>
          {(isMobile || open) && (
            <Typography sx={{
              fontSize: 9.5, fontWeight: 600, color: theme.palette.text.secondary,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              px: 2, mb: 0.5, opacity: 0.5,
            }}>
              Workspace
            </Typography>
          )}
          <List disablePadding>
            {mainItems.map((item) => (
              <NavItem
                key={item.path} item={item} open={isMobile || open}
                isActive={location.pathname === item.path}
                onClick={() => { navigate(item.path); if (isMobile) closeMobile() }}
              />
            ))}
          </List>
        </Box>

        <Divider sx={{ mx: 1, mt: 1, mb: 0, borderColor: theme.palette.divider }} />

        {/* ── New Chat ─────────────────────────────────────────────────────── */}
        {(isMobile || open) ? (
          <ListItem disablePadding sx={{ px: 0.75, py: 0.35 }}>
            <ListItemButton
              onClick={() => { onNewConversation(); if (isMobile) closeMobile() }}
              sx={{
                borderRadius: '7px', minHeight: 34, px: 1,
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                transition: 'background 0.15s',
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: 1.25, justifyContent: 'center', color: theme.palette.text.secondary }}>
                <AddIcon sx={{ fontSize: ICON_SIZE }} />
              </ListItemIcon>
              <ListItemText
                primary="New chat"
                sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 400, color: theme.palette.text.primary } }}
              />
              {!isMobile && (
                <Typography sx={{ fontSize: 9.5, color: theme.palette.text.disabled, opacity: 0.5, letterSpacing: '0.02em' }}>
                  {newChatShortcut}
                </Typography>
              )}
            </ListItemButton>
          </ListItem>
        ) : (
          <List disablePadding>
            <CollapsedBtn
              label="New chat"
              icon={<AddIcon sx={{ fontSize: ICON_SIZE }} />}
              onClick={onNewConversation}
              isActive={false} accent={accent} isDark={isDark}
            />
          </List>
        )}

        <Divider sx={{ mx: 1, mt: 0, mb: 1, borderColor: theme.palette.divider }} />

        {/* ── Conversations section ────────────────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

          {(isMobile || open) && (
            <Box sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}>
              <Box sx={{ px: 0.75, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{
                  fontSize: 9.5, fontWeight: 600, color: theme.palette.text.secondary,
                  textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.5,
                }}>
                  Your Chats
                </Typography>
                {isSearching && (
                  <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled }}>
                    {resultCount} result{resultCount !== 1 ? 's' : ''}
                  </Typography>
                )}
              </Box>

              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: '7px', px: 1, py: 0.4, mx: 0.25,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <SearchIcon sx={{ fontSize: 13, color: theme.palette.text.disabled, flexShrink: 0, opacity: 0.7 }} />
                <InputBase
                  inputRef={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur() }
                  }}
                  placeholder="Search chats…"
                  sx={{
                    flex: 1,
                    '& input': {
                      fontSize: 12, color: theme.palette.text.primary, p: 0,
                      '&::placeholder': { color: theme.palette.text.disabled, opacity: 1 },
                    },
                  }}
                />
                {!search && !isMobile && (
                  <Typography sx={{ fontSize: 9.5, color: theme.palette.text.disabled, opacity: 0.45, flexShrink: 0, letterSpacing: '0.02em' }}>
                    {searchShortcut}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {!isMobile && !open && (
            <List disablePadding>
              <CollapsedBtn
                label="Search chats"
                icon={<SearchIcon sx={{ fontSize: ICON_SIZE }} />}
                onClick={null}
                isActive={false} accent={accent} isDark={isDark}
              />
            </List>
          )}

          {/* Scrollable list */}
          <Box sx={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 1,
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
          }}>
            {(isMobile || open) && isLoading && <ConvSkeletons />}

            {(isMobile || open) && !isLoading && conversations.length === 0 && (
              <Typography sx={{
                fontSize: 12, color: theme.palette.text.secondary,
                textAlign: 'center', pt: 3, opacity: 0.45,
              }}>
                No chats yet — start one above!
              </Typography>
            )}

            {(isMobile || open) && !isLoading && isSearching && resultCount === 0 && (
              <Typography sx={{
                fontSize: 12, color: theme.palette.text.secondary,
                textAlign: 'center', pt: 2, opacity: 0.45, px: 2,
              }}>
                No chats match "{search}"
              </Typography>
            )}

            {/* ── Starred section ─────────────────────────────────────────── */}
            {(isMobile || open) && !isLoading && starred.length > 0 && (
              <Box>
                <SectionLabel>Starred</SectionLabel>
                {starred.map((conv) => (
                  <ConvItem key={conv.id} {...convItemProps(conv)} />
                ))}
                {unstarred.length > 0 && (
                  <Divider sx={{ mx: 1.5, my: 0.75, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                )}
              </Box>
            )}

            {/* ── Time-grouped chats ──────────────────────────────────────── */}
            {(isMobile || open) && !isLoading && grouped.map(([label, items]) => (
              <Box key={label}>
                <SectionLabel>{label}</SectionLabel>
                {items.map((conv) => (
                  <ConvItem key={conv.id} {...convItemProps(conv)} />
                ))}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Bottom: profile + theme + settings ──────────────────────────── */}
        <Box sx={{ flexShrink: 0 }}>
          <Divider sx={{ mx: 1, mb: 1, borderColor: theme.palette.divider }} />

          {user && (
            (isMobile || open) ? (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.75, mb: 0.25,
              }}>
                <Avatar src={user.avatar} alt={user.name} sx={{ width: 24, height: 24, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
                    {user.name}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 10, color: 'text.secondary', opacity: 0.7 }}>
                    {user.email}
                  </Typography>
                </Box>
                <Tooltip title="Sign out" placement="right" arrow>
                  <IconButton
                    size="small"
                    aria-label="Sign out"
                    onClick={logout}
                    sx={{
                      flexShrink: 0, color: theme.palette.text.disabled,
                      '&:hover': { color: theme.palette.text.secondary },
                    }}
                  >
                    <LogoutOutlinedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                <Tooltip title={`${user.name} — Sign out`} placement="right" arrow>
                  <Box
                    onClick={logout}
                    sx={{
                      cursor: 'pointer', borderRadius: '50%',
                      '&:hover': { opacity: 0.75 },
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Avatar src={user.avatar} alt={user.name} sx={{ width: 24, height: 24 }} />
                  </Box>
                </Tooltip>
              </Box>
            )
          )}

          {(isMobile || open) ? (
            <ListItem disablePadding sx={{ px: 0.75, mb: 0.25 }}>
              <ListItemButton
                onClick={onThemeToggle}
                sx={{
                  borderRadius: '7px', minHeight: 34, px: 1,
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                  transition: 'background 0.15s',
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: 1.25, justifyContent: 'center', color: theme.palette.text.secondary }}>
                  {themeMode === 'dark'
                    ? <LightModeOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
                    : <DarkModeOutlinedIcon  sx={{ fontSize: ICON_SIZE }} />
                  }
                </ListItemIcon>
                <ListItemText
                  primary={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
                  sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 400, color: theme.palette.text.primary } }}
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
              isActive={false} accent={accent} isDark={isDark}
            />
          )}

          <List disablePadding sx={{ pb: 1 }}>
            {bottomItems.map((item) => (
              <NavItem
                key={item.path} item={item} open={isMobile || open}
                isActive={location.pathname === item.path}
                onClick={() => { navigate(item.path); if (isMobile) closeMobile() }}
              />
            ))}
          </List>
        </Box>

      </Drawer>

      {/* Rename dialog — rendered outside the Drawer so it's not clipped */}
      <RenameDialog
        conv={renamingConv}
        onClose={() => setRenamingConv(null)}
        onConfirm={onRenameConv}
      />
    </Box>
  )
}

export default Sidebar
