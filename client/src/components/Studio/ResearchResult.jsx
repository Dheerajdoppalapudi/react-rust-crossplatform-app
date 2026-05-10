import { useState, useRef, Children } from 'react'
import { Box, Typography, Collapse, Tooltip, useTheme } from '@mui/material'
import ReactMarkdown   from 'react-markdown'
import BlockRenderer   from '../Interactive/BlockRenderer'
import ResponseToolbar from './ResponseToolbar'

// ── Citation chip ─────────────────────────────────────────────────────────────

function CitationChip({ num, source }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const label  = source?.title ?? `[${num}]`

  const chip = (
    <Box component="sup" sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 16, height: 16, px: 0.4,
      borderRadius: '4px', fontSize: 10, fontWeight: 600, lineHeight: 1,
      backgroundColor: isDark ? 'rgba(75,114,255,0.18)' : 'rgba(24,71,214,0.1)',
      color: isDark ? '#7b9fff' : '#1847d6',
      border: `1px solid ${isDark ? 'rgba(75,114,255,0.3)' : 'rgba(24,71,214,0.2)'}`,
      cursor: source?.url ? 'pointer' : 'default',
      mx: 0.3, verticalAlign: 'super',
      '&:hover': source?.url ? { backgroundColor: isDark ? 'rgba(75,114,255,0.28)' : 'rgba(24,71,214,0.18)' } : {},
      transition: 'background-color 0.15s',
    }}>
      {num}
    </Box>
  )

  if (!label || label === `[${num}]`) return chip

  return (
    <Tooltip title={label} placement="top" arrow>
      {chip}
    </Tooltip>
  )
}

// ── Inline citation injection ─────────────────────────────────────────────────

function injectCitations(children, sources) {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(/(\[\d+\])/g)
      if (parts.length === 1) return child
      return parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/)
        if (m) {
          const idx = parseInt(m[1]) - 1
          return <CitationChip key={i} num={m[1]} source={sources?.[idx]} />
        }
        return part || null
      })
    }
    if (child?.props?.children) {
      return { ...child, props: { ...child.props, children: injectCitations(child.props.children, sources) } }
    }
    return child
  })
}

// ── Cited markdown ────────────────────────────────────────────────────────────

function CitedMarkdown({ text, sources }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const makeComponents = () => {
    const textColor    = theme.palette.text.primary
    const mutedColor   = theme.palette.text.secondary
    const borderColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    return {
      p:          ({ children }) => (
        <Typography component="p" sx={{ fontSize: 13.5, lineHeight: 1.75, color: textColor, mb: 1.25, mt: 0 }}>
          {injectCitations(children, sources)}
        </Typography>
      ),
      li:         ({ children }) => (
        <Typography component="li" sx={{ fontSize: 13.5, lineHeight: 1.75, color: textColor, mb: 0.5 }}>
          {injectCitations(children, sources)}
        </Typography>
      ),
      h1:         ({ children }) => (
        <Typography component="h1" sx={{ fontSize: 17, fontWeight: 700, color: textColor, mt: 2, mb: 1, lineHeight: 1.35 }}>
          {injectCitations(children, sources)}
        </Typography>
      ),
      h2:         ({ children }) => (
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600, color: textColor, mt: 1.75, mb: 0.75, lineHeight: 1.4 }}>
          {injectCitations(children, sources)}
        </Typography>
      ),
      h3:         ({ children }) => (
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 600, color: textColor, mt: 1.5, mb: 0.5, lineHeight: 1.4 }}>
          {injectCitations(children, sources)}
        </Typography>
      ),
      strong:     ({ children }) => (
        <Box component="strong" sx={{ fontWeight: 700, color: textColor }}>
          {injectCitations(children, sources)}
        </Box>
      ),
      em:         ({ children }) => (
        <Box component="em" sx={{ fontStyle: 'italic', color: textColor }}>
          {injectCitations(children, sources)}
        </Box>
      ),
      ul:         ({ children }) => (
        <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 1.25, listStyleType: 'disc' }}>{children}</Box>
      ),
      ol:         ({ children }) => (
        <Box component="ol" sx={{ pl: 2.5, mt: 0.5, mb: 1.25 }}>{children}</Box>
      ),
      blockquote: ({ children }) => (
        <Box component="blockquote" sx={{
          borderLeft: `3px solid ${borderColor}`, pl: 1.5, ml: 0, my: 1.5,
          color: mutedColor, fontStyle: 'italic',
        }}>
          {children}
        </Box>
      ),
      code:       ({ inline, children }) => inline ? (
        <Box component="code" sx={{
          fontSize: 12.5, px: 0.5, py: 0.15, borderRadius: '4px',
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          fontFamily: 'monospace', color: textColor,
        }}>
          {children}
        </Box>
      ) : (
        <Box component="pre" sx={{
          fontSize: 12.5, p: 1.5, borderRadius: '8px', overflowX: 'auto', my: 1.5,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${borderColor}`, fontFamily: 'monospace', color: textColor,
        }}>
          <code>{children}</code>
        </Box>
      ),
      a:          ({ href, children }) => (
        <Box component="a" href={href} target="_blank" rel="noopener noreferrer"
          sx={{ color: isDark ? '#7b9fff' : '#1847d6', textDecoration: 'underline', textDecorationColor: 'transparent',
            '&:hover': { textDecorationColor: 'currentColor' }, transition: 'text-decoration-color 0.15s' }}>
          {children}
        </Box>
      ),
    }
  }

  return (
    <Box>
      <ReactMarkdown components={makeComponents()}>
        {text}
      </ReactMarkdown>
    </Box>
  )
}

// ── Sources panel (controlled) ────────────────────────────────────────────────

function SourcesPanel({ sources, open }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  if (!sources?.length) return null

  return (
    <Collapse in={open}>
      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1.25 }}>
        {sources.map((s, i) => {
          const domain     = s.domain || ''
          const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : null
          return (
            <Box
              key={s.url ?? i}
              component="a"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                py: 0.6, px: 0.5, borderRadius: '6px',
                textDecoration: 'none',
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
                transition: 'background-color 0.15s',
                minWidth: 0,
              }}
            >
              {/* Citation number */}
              <Typography sx={{
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                color: isDark ? 'rgba(75,114,255,0.7)' : 'rgba(24,71,214,0.6)',
                minWidth: 18,
              }}>
                [{i + 1}]
              </Typography>

              {/* Favicon */}
              <Box sx={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {faviconUrl ? (
                  <img src={faviconUrl} alt="" width={14} height={14} style={{ objectFit: 'contain', borderRadius: 2 }} />
                ) : (
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
                )}
              </Box>

              {/* Title */}
              <Typography sx={{
                flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4,
                color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.72)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.title}
              </Typography>

              {/* Domain */}
              <Typography sx={{ fontSize: 10.5, flexShrink: 0, color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)' }}>
                {domain}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Collapse>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResearchResult({
  prompt            = '',
  synthesisText     = '',
  synthesisComplete = false,
  sources           = [],
  blocks            = [],
  title             = '',
  learningObjective = null,
  isLoading         = false,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const [sourcesOpen, setSourcesOpen] = useState(true)
  // Ref on the content wrapper — passed to toolbar so html2canvas knows what to capture
  const contentRef = useRef(null)

  const hasBlocks  = blocks.length > 0
  const hasSources = sources.length > 0

  // Show toolbar whenever there is any content (text or sources), but not during
  // pure initial loading where nothing has arrived yet.
  const showToolbar = !!synthesisText || (sources.length > 0 && !isLoading)

  return (
    <Box ref={contentRef}>
      {/* Synthesis text */}
      {synthesisText && (
        <Box sx={{
          mb: hasBlocks ? 2 : 0,
          pb: hasBlocks ? 2 : 0,
          borderBottom: hasBlocks
            ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`
            : 'none',
        }}>
          <CitedMarkdown text={synthesisText} sources={sources} />
          {!synthesisComplete && isLoading && (
            <Box component="span" sx={{
              display: 'inline-block', width: 8, height: 14, ml: 0.5,
              backgroundColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
              borderRadius: '2px',
              animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }} />
          )}
        </Box>
      )}

      {/* Interactive blocks */}
      {hasBlocks && (
        <BlockRenderer
          title={title}
          learningObjective={learningObjective}
          blocks={blocks}
          isLoading={isLoading}
        />
      )}

      {/* Toolbar: copy, download (PDF/Markdown), sources badge */}
      {showToolbar && (
        <ResponseToolbar
          prompt={prompt}
          synthesisText={synthesisText}
          sources={sources}
          contentRef={contentRef}
          sourcesOpen={sourcesOpen}
          onToggleSources={() => setSourcesOpen(o => !o)}
          disabled={isLoading && !synthesisComplete}
        />
      )}

      {/* Collapsible sources list — controlled by toolbar badge */}
      {hasSources && <SourcesPanel sources={sources} open={sourcesOpen} />}
    </Box>
  )
}
