/**
 * Media token cache — CRIT-2
 *
 * Session-scoped media tokens are short-lived (5 min) JWTs that allow browser
 * <video src> and <img src> elements to authenticate without an Authorization
 * header (which browsers cannot set on resource requests).
 *
 * This module manages a per-session token cache. Tokens are refreshed proactively
 * 60 seconds before expiry so playback never interrupts mid-stream.
 *
 * Usage:
 *   const token = await getSessionMediaToken(sessionId)
 *   const url = `${API_BASE}/api/sessions/${sessionId}/video?token=${token}`
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// token_expire_minutes matches MEDIA_TOKEN_EXPIRE_MINUTES in backend/core/config.py (5 min).
// We refresh 60 s early to avoid expiry during active playback.
const TOKEN_TTL_MS  = 5 * 60 * 1000
const REFRESH_EARLY = 60 * 1000

/** @type {Map<string, { token: string, expiresAt: number }>} */
const _cache = new Map()

/** @type {Map<string, Promise<string>>} */
const _inflight = new Map()

// Cap the cache at 50 entries to prevent unbounded memory growth in long sessions.
// Evict the 10 oldest keys when the limit is reached (they're likely expired anyway).
const MAX_CACHE = 50
function _evictIfNeeded() {
  if (_cache.size <= MAX_CACHE) return
  const toEvict = [..._cache.keys()].slice(0, 10)
  toEvict.forEach((k) => _cache.delete(k))
}

import { getAccessToken } from './authBridge'

async function _fetchToken(resourceId, endpoint) {
  const accessToken = getAccessToken()
  if (!accessToken) throw new Error('Not authenticated')

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to get media token (HTTP ${res.status})`)
  }

  const body = await res.json()
  return body?.data?.media_token ?? null
}

async function _getToken(cacheKey, endpoint) {
  const cached = _cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt - REFRESH_EARLY) {
    return cached.token
  }

  // Deduplicate concurrent requests for the same key.
  if (_inflight.has(cacheKey)) {
    return _inflight.get(cacheKey)
  }

  const promise = _fetchToken(cacheKey, endpoint).then((token) => {
    _evictIfNeeded()
    _cache.set(cacheKey, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
    _inflight.delete(cacheKey)
    return token
  }).catch((err) => {
    _inflight.delete(cacheKey)
    throw err
  })

  _inflight.set(cacheKey, promise)
  return promise
}

/**
 * Get (or refresh) a media token for a session.
 * Used for video and frame image URLs.
 *
 * @param {string} sessionId
 * @returns {Promise<string>} media token
 */
export function getSessionMediaToken(sessionId) {
  return _getToken(
    `session:${sessionId}`,
    `/api/sessions/${sessionId}/media-token`,
  )
}

/**
 * Get (or refresh) a media token for a conversation.
 * Used for merged video URLs.
 *
 * @param {string} conversationId
 * @returns {Promise<string>} media token
 */
export function getConversationMediaToken(conversationId) {
  return _getToken(
    `conv:${conversationId}`,
    `/api/conversations/${conversationId}/media-token`,
  )
}

/**
 * Evict the cached token for a session (call on unmount or session change).
 * @param {string} sessionId
 */
export function clearSessionMediaToken(sessionId) {
  _cache.delete(`session:${sessionId}`)
}

/**
 * Evict the cached token for a conversation.
 * @param {string} conversationId
 */
export function clearConversationMediaToken(conversationId) {
  _cache.delete(`conv:${conversationId}`)
}
