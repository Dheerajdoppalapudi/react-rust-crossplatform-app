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
}
