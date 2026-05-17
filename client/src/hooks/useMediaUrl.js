/**
 * useMediaUrl
 *
 * Fetches and caches a short-lived session media token so that <video src> and
 * <img src> elements can load authenticated media without embedding the main
 * access JWT in the URL.
 *
 * Tokens have a 5-minute TTL on the server. This hook refreshes every 4 minutes
 * so there is always a valid token — prevents mid-playback 401s.
 *
 * Usage:
 *   const { videoUrl, getFrameUrl, loading } = useMediaUrl(sessionId)
 *   <video src={videoUrl} />
 *   <img src={getFrameUrl(frameIndex)} />
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSessionMediaToken } from '../services/mediaToken'

import { API_BASE } from '../constants/api.js'
const REFRESH_MS    = 4 * 60 * 1000  // 4 minutes — server TTL is 5 minutes

/**
 * @param {string|null} sessionId
 * @returns {{ videoUrl: string, getFrameUrl: (frameIndex: number) => string, loading: boolean, error: string|null }}
 */
export function useMediaUrl(sessionId) {
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchToken = useCallback(async (id) => {
    if (!id) return
    try {
      const t = await getSessionMediaToken(id)
      if (mountedRef.current) setToken(t)
    } catch (err) {
      if (mountedRef.current) setError(err.message || 'Failed to load media')
    }
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setToken(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchToken(sessionId).finally(() => {
      if (mountedRef.current) setLoading(false)
    })

    const intervalId = setInterval(() => fetchToken(sessionId), REFRESH_MS)
    return () => clearInterval(intervalId)
  }, [sessionId, fetchToken])

  const videoUrl = sessionId && token
    ? `${API_BASE}/api/sessions/${sessionId}/video?token=${token}`
    : ''

  const getFrameUrl = useCallback(
    (frameIndex) =>
      sessionId && token
        ? `${API_BASE}/api/sessions/${sessionId}/frame/${frameIndex}?token=${token}`
        : '',
    [sessionId, token],
  )

  return { videoUrl, getFrameUrl, loading, error }
}
