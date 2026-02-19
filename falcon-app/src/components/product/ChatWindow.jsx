import { useState, useRef, useEffect } from 'react'
import { Box } from '@mui/material'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ChatEmptyState from './ChatEmptyState'
import { api } from '../../services/api'

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const ChatWindow = () => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isExcelFile = (file) =>
    file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

  const handleSend = async (text, files = []) => {
    const fileData = files.map((f) => ({
      name: f.name,
      size: formatSize(f.size),
      type: f.type,
      url: URL.createObjectURL(f),
    }))

    const userMsg = { role: 'user', content: text, files: fileData }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const excelFiles = files.filter(isExcelFile)
      const otherFiles = files.filter((f) => !isExcelFile(f))

      // If there are Excel files, send each to the excel-formatting endpoint
      const excelResults = []
      for (const file of excelFiles) {
        const res = await api.excelFormatting(file)
        if (res.error) {
          excelResults.push({ error: res.error })
        } else {
          excelResults.push({
            downloadUrl: res.downloadUrl,
            filename: res.filename,
            sheetsProcessed: res.sheetsProcessed,
            totalRows: res.totalRows,
            llmEnhanced: res.llmEnhanced === 'True',
            themeApplied: res.themeApplied,
          })
        }
      }

      // Send remaining files + text to the regular chat endpoint
      let chatReply = ''
      if (text || otherFiles.length > 0) {
        const res = await api.chatWithFiles(text, otherFiles)
        chatReply = res.reply
      }

      // Build assistant message with download info
      const contentParts = []
      const downloads = []

      for (let i = 0; i < excelResults.length; i++) {
        const r = excelResults[i]
        if (r.error) {
          contentParts.push(`Failed to format ${excelFiles[i].name}: ${r.error}`)
        } else {
          const enhancedLabel = r.llmEnhanced ? `Theme: ${r.themeApplied}` : 'Rule-based formatting'
          contentParts.push(
            `Formatted ${r.filename} (${r.sheetsProcessed} sheet(s), ${r.totalRows} rows — ${enhancedLabel})`
          )
          downloads.push({ url: r.downloadUrl, filename: r.filename })
        }
      }

      if (chatReply) contentParts.push(chatReply)

      const botMsg = {
        role: 'assistant',
        content: contentParts.join('\n\n'),
        downloads,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      const botMsg = { role: 'assistant', content: 'Sorry, could not reach the server.' }
      setMessages((prev) => [...prev, botMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        backgroundColor: '#fff',
      }}
    >
      {/* Scrollable messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#e0e0e0',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#ccc',
          },
        }}
      >
        {messages.length === 0 ? (
          <ChatEmptyState />
        ) : (
          <Box
            sx={{
              maxWidth: 680,
              width: '100%',
              mx: 'auto',
              py: 4,
              px: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                }}
              >
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderRadius: '6px',
                    backgroundColor: '#f7f7f8',
                    color: '#999',
                    fontSize: 14,
                  }}
                >
                  Thinking...
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

      {/* Fixed input */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </Box>
  )
}

export default ChatWindow
