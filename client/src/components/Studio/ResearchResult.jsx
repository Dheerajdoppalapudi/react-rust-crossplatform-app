import { useState, Children } from 'react'
import { Box, Typography, Collapse, IconButton, Tooltip, useTheme } from '@mui/material'
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore'
import OpenInNewIcon   from '@mui/icons-material/OpenInNew'
import ReactMarkdown   from 'react-markdown'
import BlockRenderer   from '../Interactive/BlockRenderer'

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
// Recursively processes React children, splitting text nodes on [N] patterns.

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
    // Non-string React element — recurse into its props.children if present
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

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source, index }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const domain   = source.domain || ''
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : null

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 0.5,
      px: 1.5, py: 1.25,
      borderRadius: '10px',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      '&:hover': {
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)',
      },
      transition: 'border-color 0.15s',
    }}>
      {/* Domain row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '3px', flexShrink: 0,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt="" width={12} height={12} style={{ objectFit: 'contain' }} />
          ) : (
            <Typography sx={{ fontSize: 8, color: theme.palette.text.secondary }}>?</Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, fontWeight: 500 }}>
          [{index}] {domain}
        </Typography>
      </Box>

      {/* Title */}
      <Box component="a" href={source.url} target="_blank" rel="noopener noreferrer" sx={{
        fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
        color: isDark ? '#7b9fff' : '#1847d6',
        textDecoration: 'none',
        display: 'flex', alignItems: 'flex-start', gap: 0.5,
        '&:hover span': { textDecoration: 'underline' },
      }}>
        <Box component="span" sx={{ flex: 1 }}>{source.title}</Box>
        <OpenInNewIcon sx={{ fontSize: 11, flexShrink: 0, mt: 0.2, opacity: 0.6 }} />
      </Box>

      {/* Snippet */}
      {source.snippet && (
        <Typography sx={{
          fontSize: 11.5, color: theme.palette.text.secondary,
          lineHeight: 1.55, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {source.snippet}
        </Typography>
      )}
    </Box>
  )
}

// ── Sources panel ─────────────────────────────────────────────────────────────

function SourcesPanel({ sources }) {
  const theme  = useTheme()
  const [open, setOpen] = useState(true)

  if (!sources?.length) return null

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          background: 'none', border: 'none', cursor: 'pointer', p: 0,
          color: theme.palette.text.secondary,
          '&:hover': { color: theme.palette.text.primary },
          transition: 'color 0.15s',
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Sources ({sources.length})
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 16,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }} />
      </Box>

      <Collapse in={open}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1.25 }}>
          {sources.map((s, i) => (
            <SourceCard key={s.url ?? i} source={s} index={i + 1} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Renders the result of a deep research generation:
 *  1. Cited synthesis text (streaming or final)
 *  2. Interactive visual blocks (if any)
 *  3. Collapsible sources panel
 *
 * Used in ConversationThread when turn.synthesisText || turn.sources?.length > 0
 * in combination with an interactive render path.
 */
export default function ResearchResult({
  synthesisText     = '',
  synthesisComplete = false,
  sources           = [],
  blocks            = [],
  title             = '',
  learningObjective = null,
  isLoading         = false,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const hasBlocks = blocks.length > 0
  const hasSources = sources.length > 0

  return (
    <Box>
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

      {/* Sources */}
      {hasSources && <SourcesPanel sources={sources} />}
    </Box>
  )
}
