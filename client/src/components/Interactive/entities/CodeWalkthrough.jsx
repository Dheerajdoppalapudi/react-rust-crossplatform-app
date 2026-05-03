import { useState, useCallback } from 'react'
import { Box, Typography, Paper, Tooltip, IconButton, Chip, useTheme } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon       from '@mui/icons-material/Check'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark }  from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useSceneStore } from '../useSceneStore'

import python     from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import java       from 'react-syntax-highlighter/dist/esm/languages/hljs/java'
import cpp        from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp'
import bash       from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'

SyntaxHighlighter.registerLanguage('python',     python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('java',       java)
SyntaxHighlighter.registerLanguage('cpp',        cpp)
SyntaxHighlighter.registerLanguage('bash',       bash)
SyntaxHighlighter.registerLanguage('typescript', typescript)

export default function CodeWalkthrough({ entityId, language = 'python', code = '', steps = [] }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const step    = useSceneStore(s => s.getStep(entityId))

  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [code])

  const currentStep   = steps[step] ?? steps[0]
  const highlightLine = currentStep?.line ?? null
  const explanation   = currentStep?.explanation ?? ''

  const lineProps = (lineNumber) => {
    if (lineNumber === highlightLine) {
      return {
        style: {
          display: 'block',
          backgroundColor: isDark ? 'rgba(74,171,255,0.18)' : 'rgba(24,71,214,0.10)',
          borderLeft: `3px solid ${isDark ? '#4dabf7' : '#1847D6'}`,
          paddingLeft: '8px',
          marginLeft: '-8px',
        },
      }
    }
    return {}
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      {/* Header: language badge + copy button */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75,
        backgroundColor: isDark ? '#161b22' : '#f6f8fa',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Chip
          label={language}
          size="small"
          sx={{
            height: 20, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
          }}
        />
        {highlightLine && (
          <Typography sx={{ fontSize: 11, color: isDark ? '#4dabf7' : '#1847D6', opacity: 0.8 }}>
            Line {highlightLine}
          </Typography>
        )}
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
          <IconButton size="small" onClick={handleCopy} aria-label="Copy code"
            sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', width: 24, height: 24 }}>
            {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <SyntaxHighlighter
        language={language}
        style={isDark ? atomOneDark : atomOneLight}
        showLineNumbers
        wrapLines
        lineProps={lineProps}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: 13.5, lineHeight: 1.6 }}
      >
        {code}
      </SyntaxHighlighter>

      {explanation && (
        <Paper
          elevation={0}
          sx={{
            px: 2, py: 1.5,
            borderTop: '1px solid', borderColor: 'divider',
            borderRadius: 0,
            backgroundColor: isDark ? 'rgba(74,171,255,0.06)' : 'rgba(24,71,214,0.04)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55, fontSize: 13 }}>
            {explanation}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
