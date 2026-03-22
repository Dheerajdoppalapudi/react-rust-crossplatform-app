const API_BASE = 'http://localhost:8000'

export const api = {
  health: async () => {
    const res = await fetch(`${API_BASE}/api/health`)
    return res.json()
  },

  chat: async (message) => {
    const formData = new FormData()
    formData.append('message', message)
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  upload: async (files) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

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
      // Error response
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

  imageGeneration: async (message, conversationId = null, pauseContext = null, notesEnabled = false) => {
    const formData = new FormData()
    formData.append('message', message)
    formData.append('notes_enabled', String(notesEnabled))
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

  getSessions: async () => {
    const res = await fetch(`${API_BASE}/api/sessions`)
    return res.json()
  },

  generateVideo: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/generate_video/${sessionId}`, { method: 'POST' })
    return res.json()
  },

  getFramesMeta: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/frames-meta`)
    if (!res.ok) return null
    return res.json()
  },

  checkVideoExists: async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/video`, { method: 'HEAD' })
      return res.ok
    } catch {
      return false
    }
  },

  // URL builders (not async — just return the URL string)
  getVideoUrl:  (sessionId)             => `${API_BASE}/api/sessions/${sessionId}/video`,
  getFrameUrl:  (sessionId, frameIndex) => `${API_BASE}/api/sessions/${sessionId}/frame/${frameIndex}`,
}
