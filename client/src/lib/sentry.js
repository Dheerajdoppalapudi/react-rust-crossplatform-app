/**
 * Sentry wrapper — centralises all error-tracking calls.
 *
 * All functions are no-ops when:
 *   - VITE_SENTRY_DSN is not set (local dev, staging without DSN)
 *   - Running in development mode (import.meta.env.DEV)
 *
 * Usage:
 *   import { captureException, setUser } from '@lib/sentry'
 */

let _initialized = false

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || import.meta.env.DEV) return

  // Dynamic import keeps Sentry out of the main bundle when DSN is not configured.
  // At runtime the module is already loaded (it's in vendor chunks), so there's
  // no waterfall — this just avoids the synchronous init blocking first paint.
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment:      import.meta.env.VITE_APP_ENV ?? 'production',
      release:          import.meta.env.VITE_APP_VERSION ?? __APP_VERSION__,
      tracesSampleRate: 0.1,   // 10% — full sampling would be extremely expensive at scale
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
    })
    _initialized = true
  })
}

export async function captureException(error, context) {
  if (import.meta.env.DEV || !_initialized) return
  const Sentry = await import('@sentry/react')
  Sentry.captureException(error, { extra: context })
}

export async function setUser(user) {
  if (import.meta.env.DEV || !_initialized) return
  const Sentry = await import('@sentry/react')
  // user = { id, email, name } or null on logout
  Sentry.setUser(user ? { id: user.id, email: user.email } : null)
}

/**
 * Wrap an async operation in a Sentry performance span.
 * No-op in dev or when Sentry is not initialized.
 *
 * @param {string}   name - Span name shown in Sentry Performance.
 * @param {string}   op   - Operation type: 'ui.action', 'http.client', etc.
 * @param {Function} fn   - Async function to instrument.
 */
export async function withSpan(name, op, fn) {
  if (import.meta.env.DEV || !_initialized) return fn()
  const Sentry = await import('@sentry/react')
  return Sentry.startSpan({ name, op }, fn)
}

/**
 * Higher-order component that wraps a component with Sentry's React profiler.
 * Returns the component unchanged in dev / when Sentry is not initialized.
 *
 * @param {React.ComponentType} Component
 * @param {string} [name] - Optional display name override.
 */
export function withProfiler(Component, name) {
  if (import.meta.env.DEV) return Component
  // Use dynamic require pattern — @sentry/react is always in the vendor chunk.
  // We access it synchronously here because withProfiler is called at module
  // definition time (not inside a render), so dynamic import is not viable.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react')
    return Sentry.withProfiler(Component, { name: name ?? Component.displayName ?? Component.name })
  } catch {
    return Component
  }
}
