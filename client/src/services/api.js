const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Core request helper ────────────────────────────────────────────────────────
//
// All JSON endpoints return the standard envelope:
//   success → { "status": "success", "data": <payload> }
//   error   → { "status": "error",   "error": "<message>" }
//
// _request() unwraps the envelope and returns `data` on success.
// On any error (HTTP error status OR status:"error" body) it throws an Error
// whose `.message` is the human-readable error string from the server.
//
// File/stream responses (video download, frame images, SSE) bypass this helper
// and use raw fetch — they are not JSON envelopes.
//
// Auth:
//   - getAccessToken() reads the current access JWT from AuthContext (memory only).
//   - credentials:'include' ensures the refresh cookie is sent on /auth/refresh calls.
//   - On 401: attempt one silent refresh, then retry the original request.
//     If the refresh fails too → logout (wipe state, user sees /login).

import { getAccessToken, getRefreshCallback, getLogoutCallback } from './authBridge'
export { setAuthCallbacks } from './authBridge'

async function _request(url, options = {}) {
  const token = getAccessToken()

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let res
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',   // send refresh cookie on /auth/refresh calls
    })
  } catch (networkErr) {
    throw new Error('Network error — check your connection and try again.')
  }

  // On 401 — attempt silent token refresh then retry once
  const _refreshCallback = getRefreshCallback()
  if (res.status === 401 && _refreshCallback) {
    const newToken = await _refreshCallback()
    if (newToken) {
      // Retry with the new token
      try {
        res = await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${newToken}`,
          },
          credentials: 'include',
        })
      } catch {
        throw new Error('Network error — check your connection and try again.')
      }
    } else {
      // Refresh failed — force logout
      const _logoutCallback = getLogoutCallback()
      if (_logoutCallback) _logoutCallback()
      throw new Error('Your session has expired. Please sign in again.')
    }
  }

  // Parse body (all non-file API responses are JSON)
  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status})`)
  }

  // Standard error envelope
  if (body.status === 'error') {
    const err = new Error(body.error || `Request failed (HTTP ${res.status})`)
    err.httpStatus = res.status
    throw err
  }

  // HTTP error that somehow didn't have our error envelope (e.g. proxy error)
  if (!res.ok) {
    const err = new Error(body.detail || body.error || `Request failed (HTTP ${res.status})`)
    err.httpStatus = res.status
    throw err
  }

  // Unwrap the success envelope
  return body.data ?? body
}

// ── API surface ────────────────────────────────────────────────────────────────

export const api = {

  // ── Generation ───────────────────────────────────────────────────────────────

  imageGeneration: async (message, conversationId = null, pauseContext = null, notesEnabled = false, provider = 'claude', model = null) => {
    const formData = new FormData()
    formData.append('message', message)
    formData.append('notes_enabled', String(notesEnabled))
    formData.append('provider', provider)
    if (model)          formData.append('model', model)
    if (conversationId) formData.append('conversation_id', conversationId)
    if (pauseContext) {
      formData.append('pause_session_id',  pauseContext.sessionId)
      formData.append('pause_frame_index', String(pauseContext.frameIndex))
      if (pauseContext.caption) formData.append('pause_caption', pauseContext.caption)
      formData.append('parent_session_id', pauseContext.sessionId)
      if (pauseContext.frameIndex != null) {
        formData.append('parent_frame_index', String(pauseContext.frameIndex))
      }
    }
    return _request(`${API_BASE}/api/image_generation`, { method: 'POST', body: formData })
  },

  chatWithFiles: async (message, files = []) => {
    const formData = new FormData()
    formData.append('message', message)
    files.forEach((file) => formData.append('files', file))
    return _request(`${API_BASE}/api/chat-with-files`, { method: 'POST', body: formData })
  },

  // ── Conversations ─────────────────────────────────────────────────────────────

  getConversations: async () => {
    return _request(`${API_BASE}/api/conversations`)
  },

  // Returns the conversation object or null if not found / deleted.
  getConversation: async (convId) => {
    try {
      return await _request(`${API_BASE}/api/conversations/${convId}`)
    } catch {
      return null
    }
  },

  // Returns the conversation tree or null on any error.
  getConversationTree: async (convId) => {
    try {
      return await _request(`${API_BASE}/api/conversations/${convId}/tree`)
    } catch {
      return null
    }
  },

  mergeConversation: async (convId) => {
    return _request(`${API_BASE}/api/conversations/${convId}/merge`, { method: 'POST' })
  },

  // Returns { content, updated_at } or null on error.
  getConversationNotes: async (convId) => {
    try {
      return await _request(`${API_BASE}/api/conversations/${convId}/notes`)
    } catch {
      return null
    }
  },

  updateConversationNotes: async (convId, content) => {
    return _request(`${API_BASE}/api/conversations/${convId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  },

  // ── Sessions ──────────────────────────────────────────────────────────────────

  // Returns the frames metadata object or null on any error.
  getFramesMeta: async (sessionId) => {
    try {
      return await _request(`${API_BASE}/api/sessions/${sessionId}/frames-meta`)
    } catch {
      return null
    }
  },

  // ── Video (SSE stream) ────────────────────────────────────────────────────────
  //
  // Not JSON-wrapped — it is a Server-Sent Event stream.
  // onEvent is called for every event object:
  //   { type: "stage",        stage: "export_frames"|"tts"|"assembling", ... }
  //   { type: "stage_done",   stage: "...", duration_s: 1.2, ... }
  //   { type: "tts_progress", frame: 1, total: 5 }
  //   { type: "heartbeat",    elapsed_s: 22 }
  //   { type: "done",         session_id: "...", video_path: "...", ... }
  //   { type: "error",        message: "..." }

  generateVideoStream: (sessionId, onEvent) => {
    const token = getAccessToken()
    return fetch(`${API_BASE}/api/generate_video/${sessionId}?use_openai_tts=true`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          // Pre-flight errors (404, 400, 503) come back as { status:"error", error:"..." }
          let message = `HTTP ${res.status}`
          try {
            const body = await res.json()
            message = body.error || body.detail || message
          } catch {}
          onEvent({ type: 'error', message })
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      })
  },

  // ── URL builders (synchronous — return strings, not Promises) ─────────────────

  getVideoUrl:       (sessionId)             => { const t = getAccessToken(); return `${API_BASE}/api/sessions/${sessionId}/video${t ? `?token=${t}` : ''}` },
  getFrameUrl:       (sessionId, frameIndex) => { const t = getAccessToken(); return `${API_BASE}/api/sessions/${sessionId}/frame/${frameIndex}${t ? `?token=${t}` : ''}` },
  getMergedVideoUrl: (convId)               => `${API_BASE}/api/conversations/${convId}/merged_video`,
}
