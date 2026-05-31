import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Typography, Box, Divider, useTheme, useMediaQuery, InputBase, IconButton,
  Skeleton, Avatar, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField,
} from '@mui/material'
import HomeOutlinedIcon        from '@mui/icons-material/HomeOutlined'
import SettingsOutlinedIcon    from '@mui/icons-material/SettingsOutlined'
import SearchIcon              from '@mui/icons-material/Search'
import AddIcon                 from '@mui/icons-material/Add'
import DarkModeOutlinedIcon    from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon   from '@mui/icons-material/LightModeOutlined'
import ChevronLeftIcon         from '@mui/icons-material/ChevronLeft'
import ZenithLogo              from './ZenithLogo'
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
import { PALETTE, RADIUS } from '../../theme/tokens.js'
import { metaText } from '../../theme/styleUtils.js'
import { TIMINGS } from '../../constants/timings.js'

const DRAWER_OPEN   = 260
const DRAWER_CLOSED = 56
const ICON_SIZE     = 17

const mainItems = [
  { label: 'About Us', path: '/', icon: <HomeOutlinedIcon sx={{ fontSize: ICON_SIZE }} /> },
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
const LogoButton = ({ onToggle }) => {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip title="Expand" placement="right" arrow>
      <Box
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background 0.15s',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        }}
      >
        {hovered
          ? <ChevronRightIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
          : <ZenithLogo sx={{ fontSize: 30, color: theme.palette.text.primary }} />
        }
      </Box>
    </Tooltip>
  )
}

// ─── Single nav item — icon always visible, text fades via CSS ───────────────
const NavItem = memo(({ item, open, isActive, onClick }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const activeBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'
  const hoverBg  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <Tooltip title={open ? '' : item.label} placement="right" arrow>
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
          sx={{
            borderRadius: `${RADIUS.ui}px`, minHeight: 34, px: 0, mx: 0.75,
            overflow: 'hidden',
            bgcolor: isActive ? activeBg : 'transparent',
            '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
            transition: 'background 0.15s',
          }}
        >
          {/* Icon always in a fixed-width column — never moves */}
          <Box sx={{
            width: 38, minWidth: 38, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.palette.text.secondary,
          }}>
            {item.icon}
          </Box>

          {/* Text fades via CSS — no unmount/remount */}
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 0.5,
            overflow: 'hidden', whiteSpace: 'nowrap',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.18s ease',
          }}>
            <Typography sx={{
              fontSize: 12.5, fontWeight: isActive ? 600 : 400,
              color: theme.palette.text.primary,
            }}>
              {item.label}
            </Typography>
          </Box>
        </ListItemButton>
      </ListItem>
    </Tooltip>
  )
})

// ─── Single conversation row ───────────────────────────────────────────────────
const ConvItem = memo(({ conv, isActive, onSelect, onRename, onStar, onDelete }) => {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
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
        sx={{
          px: 1.25, py: 0.75, mx: 0.75, mb: 0.1,
          borderRadius: `${RADIUS.lg}px`, cursor: 'pointer',
          bgcolor: isActive
            ? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)')
            : 'transparent',
          '&:hover': {
            bgcolor: isActive
              ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
              : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
          },
          // On hover: hide time, show actions
          '&:hover .conv-time':    { opacity: 0 },
          '&:hover .conv-actions': { opacity: 1 },
          transition: 'background 0.15s',
          display: 'flex', alignItems: 'center', gap: 0.75,
        }}
      >
        {/* Title — truncated, fills available space */}
        <Typography noWrap sx={{
          flex: 1, minWidth: 0,
          fontSize: 13, fontWeight: isActive ? 500 : 400,
          color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
          lineHeight: 1.4,
        }}>
          {conv.title || 'Untitled'}
        </Typography>

        {/* Right slot: time + actions stacked in same space */}
        <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {/* Timestamp — always visible, hidden on row hover */}
          <Typography
            className="conv-time"
            sx={{
              fontSize: 10.5, fontWeight: 400,
              color: metaText(isDark),
              lineHeight: 1, whiteSpace: 'nowrap',
              transition: 'opacity 0.12s',
            }}
          >
            {relativeTime(conv.updated_at)}
          </Typography>

          {/* Three-dot menu — overlays timestamp on hover or when menu open */}
          <Box
            className="conv-actions"
            sx={{
              position: 'absolute', right: -2,
              opacity: menuAnchor ? 1 : 0,
              transition: 'opacity 0.12s',
            }}
          >
            <IconButton
              size="small"
              aria-label="Conversation options"
              onClick={openMenu}
              sx={{
                p: 0.25,
                color: theme.palette.text.disabled,
                borderRadius: '5px',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  color: theme.palette.text.secondary,
                },
              }}
            >
              <MoreHorizIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
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
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Typography sx={{
      fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em',
      color: metaText(isDark),
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
  isLoading      = false,
  hasMore        = false,
  isLoadingMore  = false,
  onLoadMore     = () => {},
  mobileOpen     = false,
  onMobileClose,
}) => {
  const theme    = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark   = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user, logout } = useAuth()

  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [renamingConv, setRenamingConv] = useState(null)
  const searchRef     = useRef(null)
  const debounceTimer = useRef(null)

  // Debounce search so filtering only runs after the user pauses typing
  const handleSearchChange = useCallback((val) => {
    setSearch(val)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 150)
  }, [])

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
        setTimeout(() => searchRef.current?.focus(), TIMINGS.SEARCH_OPEN_FOCUS_DELAY_MS)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMac, onNewConversation])

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return conversations
    const q = debouncedSearch.toLowerCase()
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q))
  }, [conversations, debouncedSearch])

  const starred    = useMemo(() => filtered.filter((c) => c.starred), [filtered])
  const unstarred  = useMemo(() => filtered.filter((c) => !c.starred), [filtered])
  const grouped    = useMemo(() => groupConversations(unstarred), [unstarred])
  const resultCount  = filtered.length
  const isSearching  = debouncedSearch.trim().length > 0

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
          transition: 'width 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
          '& .MuiDrawer-paper': {
            width: DRAWER_OPEN,
            transition: isMobile ? 'none' : 'width 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'width',
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
          justifyContent: (isMobile || open) ? 'space-between' : 'center',
          px: (isMobile || open) ? 1 : 0,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          mx: '6px',
        }}>
          {/* Collapsed desktop — big icon, click to expand */}
          {!isMobile && !open && <LogoButton onToggle={toggleOpen} />}

          {/* Open / mobile — logo on left */}
          {(isMobile || open) && (
            <ZenithLogo sx={{ fontSize: 34, color: theme.palette.text.primary }} />
          )}

          {/* Close / collapse button on right */}
          {(isMobile || open) && (
            <IconButton
              size="small"
              aria-label="Close sidebar"
              onClick={(e) => { e.stopPropagation(); isMobile ? closeMobile() : toggleOpen() }}
              sx={{
                width: 28, height: 28, borderRadius: `${RADIUS.ui}px`, flexShrink: 0,
                color: theme.palette.text.disabled,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  color: theme.palette.text.secondary,
                },
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
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

        {/* ── New Chat — icon always visible, text fades ────────────────── */}
        <Tooltip title={open || isMobile ? '' : 'New chat'} placement="right" arrow>
          <ListItem disablePadding sx={{ py: 0.35 }}>
            <ListItemButton
              onClick={() => { onNewConversation(); if (isMobile) closeMobile() }}
              sx={{
                borderRadius: `${RADIUS.ui}px`, minHeight: 34, px: 0, mx: 0.75,
                overflow: 'hidden',
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{ width: 38, minWidth: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary }}>
                <AddIcon sx={{ fontSize: ICON_SIZE }} />
              </Box>
              <Box sx={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 1,
                overflow: 'hidden', whiteSpace: 'nowrap',
                opacity: (open || isMobile) ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 400, color: theme.palette.text.primary }}>
                  New chat
                </Typography>
                {!isMobile && (
                  <Typography sx={{ fontSize: 9.5, color: theme.palette.text.disabled, opacity: 0.5, letterSpacing: '0.02em', ml: 'auto', mr: 0.5 }}>
                    {newChatShortcut}
                  </Typography>
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        </Tooltip>

        <Divider sx={{ mx: 1, mt: 0, mb: 1, borderColor: theme.palette.divider }} />

        {/* ── Conversations section ────────────────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

          {(isMobile || open) && (
            <Box sx={{ flexShrink: 0, mb: 0.5 }}>
              <Box sx={{ px: 1.75, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

              {/* Search box — same mx as New Chat button so widths align */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: `${RADIUS.ui}px`, px: 1.25, py: 0.65, mx: 0.75,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <SearchIcon sx={{ fontSize: 13, color: theme.palette.text.disabled, flexShrink: 0, opacity: 0.7 }} />
                <InputBase
                  inputRef={searchRef}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearch(''); setDebouncedSearch(''); searchRef.current?.blur() }
                  }}
                  placeholder="Search chats…"
                  sx={{
                    flex: 1,
                    '& input': {
                      fontSize: 12.5, color: theme.palette.text.primary, p: 0,
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
            <Tooltip title="Search chats" placement="right" arrow>
              <ListItem disablePadding sx={{ mb: 0.25 }}>
                <ListItemButton
                  sx={{
                    borderRadius: `${RADIUS.ui}px`, minHeight: 34, px: 0, mx: 0.75,
                    justifyContent: 'center',
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                    transition: 'background 0.15s',
                  }}
                >
                  <SearchIcon sx={{ fontSize: ICON_SIZE, color: theme.palette.text.secondary }} />
                </ListItemButton>
              </ListItem>
            </Tooltip>
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

            {/* ── Load more button ─────────────────────────────────────────── */}
            {(isMobile || open) && !isLoading && !isSearching && hasMore && (
              <Box sx={{ px: 1.5, pt: 0.5, pb: 1 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="text"
                  disabled={isLoadingMore}
                  onClick={onLoadMore}
                  sx={{
                    fontSize: 11.5, fontWeight: 400, textTransform: 'none',
                    color: theme.palette.text.disabled, borderRadius: `${RADIUS.ui}px`,
                    py: 0.5,
                    '&:hover': { color: theme.palette.text.secondary },
                  }}
                >
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Bottom: profile + theme + settings ──────────────────────────── */}
        <Box sx={{ flexShrink: 0 }}>
          <Divider sx={{ mx: 1, mb: 1, borderColor: theme.palette.divider }} />

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.75, mb: 0.25, overflow: 'hidden' }}>
              <Tooltip title={(!isMobile && !open) ? `${user.name} — Sign out` : ''} placement="right" arrow>
                <Box
                  onClick={(!isMobile && !open) ? logout : undefined}
                  sx={{
                    flexShrink: 0,
                    cursor: (!isMobile && !open) ? 'pointer' : 'default',
                    borderRadius: '50%',
                    '&:hover': { opacity: (!isMobile && !open) ? 0.75 : 1 },
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Avatar src={user.avatar} alt={user.name} sx={{ width: 24, height: 24 }} />
                </Box>
              </Tooltip>
              <Box sx={{
                flex: 1, minWidth: 0, ml: 1,
                display: 'flex', alignItems: 'center', gap: 0.5,
                overflow: 'hidden', whiteSpace: 'nowrap',
                opacity: (open || isMobile) ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}>
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
            </Box>
          )}

          {/* Theme toggle — icon always visible, text fades */}
          <Tooltip title={(open || isMobile) ? '' : (themeMode === 'dark' ? 'Light mode' : 'Dark mode')} placement="right" arrow>
            <ListItem disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={onThemeToggle}
                sx={{
                  borderRadius: `${RADIUS.ui}px`, minHeight: 34, px: 0, mx: 0.75,
                  overflow: 'hidden',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                  transition: 'background 0.15s',
                }}
              >
                <Box sx={{ width: 38, minWidth: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary }}>
                  {themeMode === 'dark'
                    ? <LightModeOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
                    : <DarkModeOutlinedIcon  sx={{ fontSize: ICON_SIZE }} />
                  }
                </Box>
                <Box sx={{
                  flex: 1, overflow: 'hidden', whiteSpace: 'nowrap',
                  opacity: (open || isMobile) ? 1 : 0,
                  transition: 'opacity 0.18s ease',
                }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 400, color: theme.palette.text.primary }}>
                    {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
                  </Typography>
                </Box>
              </ListItemButton>
            </ListItem>
          </Tooltip>

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
