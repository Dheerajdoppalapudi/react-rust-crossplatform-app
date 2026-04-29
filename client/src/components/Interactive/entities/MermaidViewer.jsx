import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Skeleton } from '@mui/material'
import mermaid from 'mermaid'

let _mermaidInitialised = false

function initMermaid(isDark) {
  if (_mermaidInitialised) return
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'system-ui, sans-serif',
  })
  _mermaidInitialised = true
}

let _idCounter = 0

// LLMs sometimes emit \n (literal backslash-n) inside Mermaid labels instead
// of <br/>. Mermaid silently ignores \n, so we convert it before rendering.
function fixNewlines(src) {
  return src
    .replace(/"([^"]*)"/g,    (_, s) => `"${s.replace(/\\n/g, '<br/>')}"`)
    .replace(/\[([^\]]*)\]/g, (_, s) => `[${s.replace(/\\n/g, '<br/>')}]`)
}

export default function MermaidViewer({ entityId, diagram, caption }) {
  const [svg, setSvg]     = useState(null)
  const [error, setError] = useState(null)
  const idRef             = useRef(`mermaid-${entityId ?? ++_idCounter}`)

  useEffect(() => {
    if (!diagram) return
    initMermaid(false)
    setError(null)
    setSvg(null)

    mermaid.render(idRef.current, fixNewlines(diagram))
      .then(({ svg: rendered }) => setSvg(rendered))
      .catch(err => {
        console.error('MermaidViewer render error:', err)
        setError('Could not render diagram.')
      })
  }, [diagram])

  if (error) {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 2 }}>
        <Typography variant="caption" color="error">{error}</Typography>
      </Box>
    )
  }

  if (!svg) {
    return <Skeleton variant="rectangular" sx={{ width: '100%', height: 260, borderRadius: 2 }} animation="wave" />
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', p: 2, bgcolor: 'background.paper' }}>
      <Box
        dangerouslySetInnerHTML={{ __html: svg }}
        sx={{ '& svg': { width: '100% !important', height: 'auto' } }}
      />
      {caption && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'center', color: 'text.secondary' }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
