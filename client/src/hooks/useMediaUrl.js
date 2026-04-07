/**
 * useMediaUrl — CRIT-2
 *
 * Fetches and caches a short-lived session media token so that <video src> and
 * <img src> elements can load authenticated media without embedding the main
 * access JWT in the URL.
 *
 * Usage:
 *   const { videoUrl, getFrameUrl, loading } = useMediaUrl(sessionId)
 *   <video src={videoUrl} />
 *   <img src={getFrameUrl(frameIndex)} />
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSessionMediaToken } from '../services/mediaToken'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

  useEffect(() => {
    if (!sessionId) {
      setToken(null)
      return
    }

    setLoading(true)
    setError(null)

    getSessionMediaToken(sessionId)
      .then((t) => {
        if (!mountedRef.current) return
        setToken(t)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setError(err.message || 'Failed to load media')
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [sessionId])

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
