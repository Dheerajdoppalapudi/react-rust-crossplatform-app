import { Box, Skeleton } from '@mui/material'

/**
 * Renders freeform_html entities (and any unknown entity type as a safe fallback).
 * Security: sandbox="allow-scripts" without allow-same-origin gives the iframe
 * a null origin — localStorage/cookies/document.domain are inaccessible.
 * Network requests are blocked by the CSP header set on the SSE endpoint.
 */
export default function SandboxedFrame({ html }) {
  if (!html) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{ width: '100%', height: 420, borderRadius: 2 }}
        animation="wave"
      />
    )
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      <iframe
        sandbox="allow-scripts"
        srcDoc={html}
        style={{ width: '100%', height: 420, border: 'none', display: 'block' }}
        title="interactive-widget"
      />
    </Box>
  )
}
