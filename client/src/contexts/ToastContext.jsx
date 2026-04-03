import { createContext, useContext, useCallback, useState, useMemo } from 'react'
import { Box, Alert, IconButton, Collapse } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

// ─── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(null)

let _nextId = 0

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Returns { success, error, info, warning } convenience methods.
 * Must be used inside <ToastProvider>.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Saved!')
 *   toast.error('Failed to load conversations.')
 *   toast.info('Generating…', { duration: 8000 })
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────
const DEFAULT_DURATION = { success: 4000, info: 4000, warning: 5000, error: 7000 }
const MAX_VISIBLE = 3

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(({ message, severity = 'info', duration }) => {
    const id = ++_nextId
    const ms = duration ?? DEFAULT_DURATION[severity] ?? 4000

    setToasts((prev) => {
      // Keep at most MAX_VISIBLE; drop oldest if over limit
      const next = [...prev, { id, message, severity }]
      return next.slice(-MAX_VISIBLE)
    })

    setTimeout(() => dismiss(id), ms)
    return id
  }, [dismiss])

  // Stable API object — consumers won't re-render when unrelated toasts change
  const api = useMemo(() => ({
    success: (msg, opts) => show({ message: msg, severity: 'success', ...opts }),
    error:   (msg, opts) => show({ message: msg, severity: 'error',   ...opts }),
    info:    (msg, opts) => show({ message: msg, severity: 'info',    ...opts }),
    warning: (msg, opts) => show({ message: msg, severity: 'warning', ...opts }),
    dismiss,
  }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <Box
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        alignItems: 'flex-end',
        pointerEvents: 'none',       // let clicks fall through the gap
      }}
    >
      {toasts.map((t) => (
        <Collapse key={t.id} in appear timeout={200}>
          <Alert
            severity={t.severity}
            onClose={() => onDismiss(t.id)}
            action={
              <IconButton size="small" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{
              minWidth: 280,
              maxWidth: 420,
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              pointerEvents: 'auto',  // re-enable on the alert itself
              fontSize: 13.5,
              alignItems: 'center',
            }}
          >
            {t.message}
          </Alert>
        </Collapse>
      ))}
    </Box>
  )
}
