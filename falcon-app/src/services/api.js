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
}
