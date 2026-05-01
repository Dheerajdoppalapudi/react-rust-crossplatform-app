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

// CRIT-7 / HIGH-3: Default timeout for short-lived JSON API requests (30 seconds).
// Pass timeout: null to disable (for long-running requests like imageGeneration).
// Pass timeout: N to override with a custom millisecond value.
const _DEFAULT_TIMEOUT_MS = 30_000

/**
 * Merge a caller-supplied AbortSignal with an optional timeout signal.
 * Returns { signal, cleanup } — call cleanup() in a finally block.
 */
function _buildSignal(callerSignal, timeoutMs) {
  if (!timeoutMs) {
    // No timeout — pass caller signal through as-is.
    return { signal: callerSignal ?? null, cleanup: () => {} }
  }

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs)
  callerSignal?.addEventListener('abort', () => controller.abort(), { once: true })

  return {
    signal:  controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  }
}

async function _request(url, options = {}) {
  // Pull out non-fetch options before spreading into fetch.
  const { timeout = _DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options

  const token = getAccessToken()

  const headers = {
    ...(fetchOptions.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // CRIT-7: Build a combined signal from caller abort + our timeout.
  const { signal, cleanup } = _buildSignal(callerSignal, timeout)

  let res
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',   // send refresh cookie on /auth/refresh calls
      signal,
    })
  } catch (networkErr) {
    if (networkErr.name === 'AbortError') {
      // Distinguish timeout (our controller) from caller-initiated cancel.
      const isTimeout = timeout && !callerSignal?.aborted
      throw new Error(isTimeout
        ? 'Request timed out — please try again.'
        : 'Request cancelled.')
    }
    throw new Error('Network error — check your connection and try again.')
  } finally {
    cleanup()
  }

  // On 401 — attempt silent token refresh then retry once
  const _refreshCallback = getRefreshCallback()
  if (res.status === 401 && _refreshCallback) {
    const newToken = await _refreshCallback()
    if (newToken) {
      // Retry with the new token — fresh timeout + same caller signal.
      const { signal: retrySignal, cleanup: retryCleanup } = _buildSignal(callerSignal, timeout)
      try {
        res = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...(fetchOptions.headers || {}),
            Authorization: `Bearer ${newToken}`,
          },
          credentials: 'include',
          signal: retrySignal,
        })
      } catch (retryErr) {
        if (retryErr.name === 'AbortError') throw new Error('Request timed out — please try again.')
        throw new Error('Network error — check your connection and try again.')
      } finally {
        retryCleanup()
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

// ── Private SSE helper ─────────────────────────────────────────────────────────
//
// Shared by generateVideoStream and interactiveGeneration — both implement the
// same "fetch → check response → reader loop → buffer split → processLine →
// terminalSeen guard → error surfacing" pattern verbatim. Centralising it here
// means the logic (partial-chunk buffering, final-flush, AbortError handling,
// terminalSeen guard) only lives once.

/**
 * Drains an SSE ReadableStream reader, calling onEvent for each fully-parsed
 * event object.  Handles partial chunks by buffering incomplete lines.
 *
 * Synthetic errors dispatched to onEvent:
 *   - { type: 'error', message } when the stream closes without a terminal
 *     'done' or 'error' event (e.g. unexpected server disconnect).
 *   - { type: 'error', message } when a non-abort network exception occurs.
 *
 * AbortError is silently swallowed — callers update state via the abort path,
 * not via onEvent.
 *
 * Always calls reader.releaseLock() in a finally block.
 *
 * @param {ReadableStreamDefaultReader} reader
 * @param {(event: object) => void}     onEvent
 */
async function _readSSEStream(reader, onEvent) {
  const decoder    = new TextDecoder()
  let buffer       = ''
  let terminalSeen = false   // true once 'done' or 'error' arrives

  const processLine = (line) => {
    if (!line.startsWith('data: ')) return
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === 'done' || event.type === 'error') terminalSeen = true
      onEvent(event)
    } catch {
      // Silently skip malformed JSON lines (comments, keep-alives, etc.).
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split('\n')
        // Retain the last (possibly incomplete) chunk in the buffer; flush
        // everything on the final read where done === true.
        buffer = done ? '' : (lines.pop() ?? '')
        for (const line of lines) processLine(line)
      }

      if (done) {
        // Final flush: the last SSE event may have arrived without a trailing \n.
        for (const line of buffer.split('\n')) processLine(line)
        break
      }
    }

    // If the stream closed cleanly but never sent a terminal event the consumer
    // would be stuck indefinitely — surface it as an error.
    if (!terminalSeen) {
      onEvent({ type: 'error', message: 'Stream ended unexpectedly. Please try again.' })
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      onEvent({ type: 'error', message: 'Stream interrupted. Please try again.' })
    }
  } finally {
    reader.releaseLock()
  }
}

// ── API surface ────────────────────────────────────────────────────────────────

export const api = {

  // ── Generation ───────────────────────────────────────────────────────────────

  // Options object (replaces the previous 10-positional-parameter signature).
  // signal: optional AbortSignal — pass controller.signal to cancel on navigation.
  // timeout: null — generation can run for 60-120+ seconds; no client-side timeout.
  // parentSessionId: for general follow-ups (no pause), the last completed session in
  //   the conversation — used to build the tree view edge. For pause follow-ups this is
  //   derived from pauseContext, so callers should leave it null in that case.
  imageGeneration: async ({
    message,
    conversationId  = null,
    pauseContext    = null,
    notesEnabled    = false,
    provider        = 'claude',
    model           = null,
    signal          = null,
    renderMode      = null,
    parentSessionId = null,
    textOnly        = false,
  }) => {
    const formData = new FormData()
    formData.append('message', message)
    formData.append('notes_enabled', String(notesEnabled))
    formData.append('provider', provider)
    formData.append('text_only', String(textOnly))
    if (model)          formData.append('model', model)
    if (conversationId) formData.append('conversation_id', conversationId)
    if (renderMode)     formData.append('render_mode', renderMode)
    if (pauseContext) {
      formData.append('pause_session_id', pauseContext.sessionId)
      if (pauseContext.frameIndex != null) {
        formData.append('pause_frame_index', String(pauseContext.frameIndex))
      }
      if (pauseContext.caption) formData.append('pause_caption', pauseContext.caption)
      formData.append('parent_session_id', pauseContext.sessionId)
      if (pauseContext.frameIndex != null) {
        formData.append('parent_frame_index', String(pauseContext.frameIndex))
      }
    } else if (parentSessionId) {
      formData.append('parent_session_id', parentSessionId)
    }
    return _request(`${API_BASE}/api/image_generation`, {
      method: 'POST', body: formData,
      timeout: null,  // no client timeout — server controls generation duration
      signal,
    })
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
  // signal: optional AbortSignal to cancel the request (e.g. on conversation switch).
  getConversation: async (convId, signal = null) => {
    try {
      return await _request(`${API_BASE}/api/conversations/${convId}`, { signal })
    } catch (err) {
      if (err?.name === 'AbortError') throw err   // re-throw so caller can detect cancellation
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

  renameConversation: async (convId, title) => {
    return _request(`${API_BASE}/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  },

  starConversation: async (convId) => {
    return _request(`${API_BASE}/api/conversations/${convId}/star`, { method: 'POST' })
  },

  deleteConversation: async (convId) => {
    return _request(`${API_BASE}/api/conversations/${convId}`, { method: 'DELETE' })
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
  // signal: optional AbortSignal to cancel (e.g. when loading a different conversation).
  getFramesMeta: async (sessionId, signal = null) => {
    try {
      return await _request(`${API_BASE}/api/sessions/${sessionId}/frames-meta`, { signal })
    } catch (err) {
      if (err?.name === 'AbortError') return null   // cancelled — caller checks loadSignal.aborted
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

  // CRIT-7: generateVideoStream returns an AbortController so the caller can
  // cancel the stream on component unmount. Pass controller.signal to abort.
  generateVideoStream: async (sessionId, onEvent, signal) => {
    const token = getAccessToken()
    let res
    try {
      res = await fetch(`${API_BASE}/api/generate_video/${sessionId}?use_openai_tts=true`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: 'Connection failed. Please try again.' })
      }
      return
    }

    if (!res.ok) {
      // Pre-flight errors (404, 400, 503) come back as { status:"error", error:"..." }
      let message = `HTTP ${res.status}`
      try { const body = await res.json(); message = body.error || body.detail || message } catch {}
      onEvent({ type: 'error', message })
      return
    }

    await _readSSEStream(res.body.getReader(), onEvent)
  },

  // ── Interactive generation (SSE) ─────────────────────────────────────────────
  //
  // SSE event types:
  //   { type: "content", title, text, follow_ups }
  //   { type: "entity",  entity: {...} }
  //   { type: "done",    session_id, conversation_id, turn_index }
  //   { type: "error",   message }

  interactiveGeneration: async ({ message, conversationId, parentSessionId, provider, model }, onEvent, signal) => {
    const formBody = new FormData()
    formBody.append('message', message)
    if (conversationId)   formBody.append('conversation_id',   conversationId)
    if (parentSessionId)  formBody.append('parent_session_id', parentSessionId)
    if (provider)         formBody.append('provider', provider)
    if (model)            formBody.append('model', model)

    const token = getAccessToken()
    let res
    try {
      res = await fetch(`${API_BASE}/api/interactive_generation`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formBody,
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: 'Connection failed. Please try again.' })
      }
      return
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try { const b = await res.json(); message = b.error || b.detail || message } catch {}
      onEvent({ type: 'error', message })
      return
    }

    await _readSSEStream(res.body.getReader(), onEvent)
  },

  // ── Media token endpoints (CRIT-2) ────────────────────────────────────────────
  //
  // Fetches a short-lived, session-scoped media token so that <video src> and
  // <img src> elements can authenticate without embedding the main access JWT
  // in a URL. Tokens expire in 5 minutes; use useMediaUrl() hook in components
  // to handle caching and auto-refresh automatically.

  getSessionMediaToken: (sessionId) => {
    return _request(`${API_BASE}/api/sessions/${sessionId}/media-token`, { method: 'POST' })
      .then((data) => data.media_token)
  },

  getConversationMediaToken: (conversationId) => {
    return _request(`${API_BASE}/api/conversations/${conversationId}/media-token`, { method: 'POST' })
      .then((data) => data.media_token)
  },
}
