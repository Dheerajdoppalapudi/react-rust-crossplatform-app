import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Tooltip, IconButton, useTheme } from '@mui/material'
import { useExpanded } from '../BlockWrapper'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon       from '@mui/icons-material/Check'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'
import EntityCaption from './EntityCaption'

const DOT_COLORS = ['#ff5f57', '#febc2e', '#28c840']

const SIMULATE_DELAYS = { slow: 800, normal: 350, fast: 120 }

function TerminalBlock({ block, skin }) {
  const lines = String(block.content ?? '').split('\n')

  if (block.type === 'command') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
        <Typography component="span" sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: skin.command, lineHeight: TYPOGRAPHY.lineHeights.relaxed,
          flexShrink: 0, mt: '1px',
        }}>$</Typography>
        <Typography sx={{
          fontFamily: TYPOGRAPHY.fontFamilyMono,
          fontSize: TYPOGRAPHY.sizes.bodySm,
          color: skin.code, lineHeight: TYPOGRAPHY.lineHeights.relaxed,
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
            color: skin.output, lineHeight: TYPOGRAPHY.lineHeights.relaxed,
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
        color: skin.comment, fontStyle: 'italic',
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

  // Theme-aware terminal skin — dark keeps the GitHub Dark look; light uses a clean paper style
  const skin = isDark ? {
    bg:          PALETTE.sidebarDark,
    headerBg:    '#161b22',
    headerBorder:'#21262d',
    border:      PALETTE.borderDark,
    title:       PALETTE.oliveGray,
    copy:        'rgba(255,255,255,0.3)',
    copyHover:   'rgba(255,255,255,0.6)',
    command:     BRAND.accent,
    code:        PALETTE.warmSilver,
    output:      PALETTE.oliveGray,
    comment:     PALETTE.stoneGray,
    cursor:      BRAND.accent,
  } : {
    bg:          PALETTE.warmSand,
    headerBg:    PALETTE.ivory,
    headerBorder:PALETTE.border,
    border:      PALETTE.border,
    title:       PALETTE.oliveGray,
    copy:        'rgba(0,0,0,0.3)',
    copyHover:   'rgba(0,0,0,0.6)',
    command:     BRAND.primary,
    code:        PALETTE.nearBlackText,
    output:      PALETTE.oliveGray,
    comment:     PALETTE.stoneGray,
    cursor:      BRAND.primary,
  }

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

  const titleText     = title || shell
  const visibleBlocks = blocks.slice(0, visibleCount)

  return (
    <Box>
      <Box sx={{
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        overflow: 'hidden',
        border: isExpanded ? 'none' : `1px solid ${skin.border}`,
        backgroundColor: skin.bg,
      }}>
        {/* Title bar: dots left · title center · copy right */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          px: 1.5, py: 1,
          backgroundColor: skin.headerBg,
          borderBottom: `1px solid ${skin.headerBorder}`,
        }}>
          <Box sx={{ display: 'flex', gap: 0.625 }}>
            {DOT_COLORS.map(c => (
              <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
            ))}
          </Box>
          <Typography sx={{
            fontFamily: TYPOGRAPHY.fontFamilyMono,
            fontSize: TYPOGRAPHY.sizes.caption,
            color: skin.title, letterSpacing: '0.02em',
            textAlign: 'center',
          }}>
            {titleText}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
              <IconButton size="small" onClick={handleCopy} aria-label="Copy terminal output"
                sx={{ color: skin.copy, width: 28, height: 28, '&:hover': { color: skin.copyHover } }}>
                {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 2 }}>
          {visibleBlocks.map((block, i) => (
            <TerminalBlock key={i} block={block} skin={skin} />
          ))}
          {simulate && visibleCount < blocks.length && (
            <Typography component="span" sx={{
              fontFamily: TYPOGRAPHY.fontFamilyMono, fontSize: TYPOGRAPHY.sizes.bodySm,
              color: skin.cursor, animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }}>
              ▋
            </Typography>
          )}
        </Box>
      </Box>

      <EntityCaption caption={caption} />
    </Box>
  )
}
