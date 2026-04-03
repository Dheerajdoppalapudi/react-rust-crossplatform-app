const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = {
  excelFormatting: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/excel-formatting`, {
      method: 'POST',
      body: formData,
    })

    // Check if it's a file response or a JSON error
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return { error: (await res.json()).error || 'Formatting failed' }
    }

    // File response — create a downloadable blob
    const blob = await res.blob()
    const filename =
      res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] ||
      `${file.name.replace(/\.[^.]+$/, '')}_formatted.xlsx`

    const downloadUrl = URL.createObjectURL(blob)
    return {
      downloadUrl,
      filename,
      sheetsProcessed: res.headers.get('x-sheets-processed'),
      totalRows: res.headers.get('x-total-rows'),
      llmEnhanced: res.headers.get('x-llm-enhanced'),
      themeApplied: res.headers.get('x-theme-applied'),
    }
  },

  chatWithFiles: async (message, files = []) => {
    const formData = new FormData()
    formData.append('message', message)
    files.forEach((file) => formData.append('files', file))
    const res = await fetch(`${API_BASE}/api/chat-with-files`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  imageGeneration: async (message, conversationId = null, pauseContext = null, notesEnabled = false, provider = 'claude', model = null) => {
    const formData = new FormData()
    formData.append('message', message)
    formData.append('notes_enabled', String(notesEnabled))
    formData.append('provider', provider)
    if (model) formData.append('model', model)
    if (conversationId) formData.append('conversation_id', conversationId)
    if (pauseContext) {
      // Runtime pause context (for building conversation history)
      formData.append('pause_session_id',  pauseContext.sessionId)
      formData.append('pause_frame_index', String(pauseContext.frameIndex))
      if (pauseContext.caption) formData.append('pause_caption', pauseContext.caption)
      // Tree relationship (persisted to DB so canvas can reconstruct the tree)
      formData.append('parent_session_id', pauseContext.sessionId)
      if (pauseContext.frameIndex != null) {
        formData.append('parent_frame_index', String(pauseContext.frameIndex))
      }
    }
    const res = await fetch(`${API_BASE}/api/image_generation`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  getConversations: async () => {
    const res = await fetch(`${API_BASE}/api/conversations`)
    return res.json()
  },

  getConversation: async (convId) => {
    const res = await fetch(`${API_BASE}/api/conversations/${convId}`)
    if (!res.ok) return null
    return res.json()
  },

  getConversationTree: async (convId) => {
    const res = await fetch(`${API_BASE}/api/conversations/${convId}/tree`)
    if (!res.ok) return null
    return res.json()
  },

  generateVideoStream: (sessionId, onEvent) => {
    // Returns a Promise that resolves when the stream closes (done or error).
    // onEvent is called for every SSE event object the server sends:
    //   { type: "stage",        stage: "export_frames"|"tts"|"assembling", ... }
    //   { type: "tts_progress", frame: 1, total: 5 }
    //   { type: "done",         video_path: "...", frame_count: N, tts_backend: "..." }
    //   { type: "error",        message: "..." }
    return fetch(`${API_BASE}/api/generate_video/${sessionId}`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          // Pre-flight errors (404, 400, 503) come back as plain JSON
          const data = await res.json().catch(() => ({}))
          onEvent({ type: 'error', message: data.error || `HTTP ${res.status}` })
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append new bytes and split on newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // The last element may be an incomplete line — keep it in the buffer
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            // SSE data lines start with "data: "
            if (line.startsWith('data: ')) {
              try {
                onEvent(JSON.parse(line.slice(6)))
              } catch {
                // Ignore any malformed lines
              }
            }
          }
        }
      })
  },

  getFramesMeta: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/frames-meta`)
    if (!res.ok) return null
    return res.json()
  },

  mergeConversation: async (convId) => {
    const res = await fetch(`${API_BASE}/api/conversations/${convId}/merge`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  // URL builders (not async — just return the URL string)
  getVideoUrl:       (sessionId)             => `${API_BASE}/api/sessions/${sessionId}/video`,
  getFrameUrl:       (sessionId, frameIndex) => `${API_BASE}/api/sessions/${sessionId}/frame/${frameIndex}`,
  getMergedVideoUrl: (convId)               => `${API_BASE}/api/conversations/${convId}/merged_video`,
}
