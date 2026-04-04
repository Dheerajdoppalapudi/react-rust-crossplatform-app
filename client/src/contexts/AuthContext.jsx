/**
 * AuthContext — dual-token auth state manager.
 *
 * Access token: kept in React state (memory only) — immune to XSS.
 * Refresh token: HTTP-only cookie managed by the browser — sent automatically to /auth/refresh.
 *
 * On mount: calls POST /auth/refresh to silently restore session from cookie.
 * On login:  stores access token in state, sets refresh cookie via /auth/google response.
 * On logout: calls /auth/logout (clears cookie server-side), wipes state.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setAccessToken, setAuthCallbacks, getAccessToken } from '../services/authBridge'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [isLoading, setIsLoading] = useState(true)  // true until first refresh attempt completes

  // Keep the bridge token in sync so api.js can read it without importing React
  const _setAuth = (token, user) => {
    setAccessToken(token)
    setUser(user)
  }

  // ── Silent restore on page load ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res  = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled && body.status === 'success') {
          _setAuth(body.data.access_token, body.data.user)
        }
      } catch {
        // Network error — treat as unauthenticated
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Login — called by Login.jsx with Google OAuth access token ────────────────
  const login = useCallback(async (googleAccessToken) => {
    const res  = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: googleAccessToken }),
    })
    const body = await res.json()
    if (body.status !== 'success') throw new Error(body.error || 'Login failed')
    _setAuth(body.data.access_token, body.data.user)
    return body.data.user
  }, [])

  // ── Email/password login ──────────────────────────────────────────────────────
  const loginWithPassword = useCallback(async (email, password) => {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json()
    if (body.status !== 'success') throw new Error(body.error || 'Login failed')
    _setAuth(body.data.access_token, body.data.user)
    return body.data.user
  }, [])

  // ── Register with email/password ──────────────────────────────────────────────
  const register = useCallback(async (name, email, password) => {
    const res  = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const body = await res.json()
    if (body.status !== 'success') throw new Error(body.error || 'Registration failed')
    _setAuth(body.data.access_token, body.data.user)
    return body.data.user
  }, [])

  // ── Token refresh — called by api.js on 401 ───────────────────────────────────
  const refresh = useCallback(async () => {
    const res  = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) { _setAuth(null, null); return null }
    const body = await res.json()
    if (body.status !== 'success') { _setAuth(null, null); return null }
    _setAuth(body.data.access_token, body.data.user)
    return body.data.access_token
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const token = getAccessToken()
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      // Clear state regardless of network errors
    }
    _setAuth(null, null)
  }, [])

  // Register callbacks so api.js can trigger refresh/logout without importing React hooks
  useEffect(() => {
    setAuthCallbacks(refresh, logout)
  }, [refresh, logout])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithPassword, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
