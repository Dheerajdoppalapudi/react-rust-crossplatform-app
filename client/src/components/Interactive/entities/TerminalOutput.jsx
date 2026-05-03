import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import { useExpanded } from '../BlockWrapper'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon       from '@mui/icons-material/Check'
import { TYPOGRAPHY, RADIUS } from '../../../theme/tokens'

const DOT_COLORS = ['#ff5f57', '#febc2e', '#28c840']

const SIMULATE_DELAYS = { slow: 800, normal: 350, fast: 120 }

function TerminalBlock({ block }) {
  const lines = String(block.content ?? '').split('\n')

  if (block.type === 'command') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
        <Typography component="span" sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: '#4B72FF', lineHeight: TYPOGRAPHY.lineHeights.relaxed,
          flexShrink: 0, mt: '1px',
        }}>$</Typography>
        <Typography sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: '#e6edf3', lineHeight: TYPOGRAPHY.lineHeights.relaxed,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {block.content}
        </Typography>
      </Box>
    )
  }

  if (block.type === 'output') {
    return (
      <Box sx={{ mb: 0.5, pl: 1.5 }}>
        {lines.map((line, i) => (
          <Typography key={i} sx={{
            fontFamily: TYPOGRAPHY.fontFamilyMono,
            fontSize: TYPOGRAPHY.sizes.bodySm,
            color: '#8b949e', lineHeight: TYPOGRAPHY.lineHeights.relaxed,
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {line || ' '}
          </Typography>
        ))}
      </Box>
    )
  }

  if (block.type === 'comment') {
    return (
      <Typography sx={{
        fontFamily: TYPOGRAPHY.fontFamilyMono,
        fontSize: TYPOGRAPHY.sizes.bodySm,
        color: '#6e7681', fontStyle: 'italic',
        lineHeight: TYPOGRAPHY.lineHeights.relaxed, mb: 0.5,
      }}>
        # {block.content}
      </Typography>
    )
  }

  return null
}

export default function TerminalOutput({
  blocks   = [],
  shell    = 'bash',
  title,
  caption,
  simulate = false,
  speed    = 'normal',
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  const [visibleCount, setVisibleCount] = useState(simulate ? 0 : blocks.length)
  const [copied,       setCopied]       = useState(false)

  useEffect(() => {
    if (!simulate || blocks.length === 0) return
    setVisibleCount(0)
    const delay = SIMULATE_DELAYS[speed] ?? SIMULATE_DELAYS.normal
    let i = 0
    const id = setInterval(() => {
      i++
      setVisibleCount(i)
      if (i >= blocks.length) clearInterval(id)
    }, delay)
    return () => clearInterval(id)
  }, [simulate, blocks.length, speed])

  const handleCopy = useCallback(async () => {
    const text = blocks.map(b =>
      b.type === 'command' ? `$ ${b.content}` : (b.content ?? '')
    ).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [blocks])

  const titleText    = title || shell
  const visibleBlocks = blocks.slice(0, visibleCount)

  return (
    <Box>
      <Box sx={{
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: isExpanded ? 'none' : `1px solid ${isDark ? '#1e293b' : '#374151'}`,
        backgroundColor: '#0d1117',
      }}>
        {/* Title bar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 1,
          backgroundColor: '#161b22',
          borderBottom: '1px solid #21262d',
        }}>
          <Typography sx={{
            fontFamily: TYPOGRAPHY.fontFamilyMono,
            fontSize: TYPOGRAPHY.sizes.caption,
            color: '#8b949e', letterSpacing: '0.02em',
          }}>
            {titleText}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
              <IconButton size="small" onClick={handleCopy} aria-label="Copy terminal output"
                sx={{ color: 'rgba(255,255,255,0.3)', width: 22, height: 22, '&:hover': { color: 'rgba(255,255,255,0.6)' } }}>
                {copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
              </IconButton>
            </Tooltip>
            <Box sx={{ display: 'flex', gap: 0.625 }}>
              {DOT_COLORS.map(c => (
                <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 2 }}>
          {visibleBlocks.map((block, i) => (
            <TerminalBlock key={i} block={block} />
          ))}
          {simulate && visibleCount < blocks.length && (
            <Typography component="span" sx={{
              fontFamily: TYPOGRAPHY.fontFamilyMono, fontSize: TYPOGRAPHY.sizes.bodySm,
              color: '#4B72FF', animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }}>
              ▋
            </Typography>
          )}
        </Box>
      </Box>

      {caption && (
        <Typography sx={{
          mt: 1, fontSize: TYPOGRAPHY.sizes.caption, textAlign: 'center',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
