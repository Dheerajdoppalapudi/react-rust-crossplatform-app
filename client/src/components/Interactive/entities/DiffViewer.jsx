import { useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import python     from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import java       from 'react-syntax-highlighter/dist/esm/languages/hljs/java'
import cpp        from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp'
import go         from 'react-syntax-highlighter/dist/esm/languages/hljs/go'
import bash       from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

SyntaxHighlighter.registerLanguage('python',     python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('java',       java)
SyntaxHighlighter.registerLanguage('cpp',        cpp)
SyntaxHighlighter.registerLanguage('go',         go)
SyntaxHighlighter.registerLanguage('bash',       bash)

// Simple Myers-style line diff — returns array of { type: 'equal'|'delete'|'insert', line }
function computeLineDiff(before, after) {
  const aLines = before.split('\n')
  const bLines = after.split('\n')
  const m = aLines.length
  const n = bLines.length

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aLines[i - 1] === bLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce diff
  const result = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.unshift({ type: 'equal',  line: aLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'insert', line: bLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'delete', line: aLines[i - 1] })
      i--
    }
  }
  return result
}

function LineNumber({ n, isDark }) {
  return (
    <Box component="span" sx={{
      display: 'inline-block',
      minWidth: 32,
      pr: 1.5,
      textAlign: 'right',
      color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      userSelect: 'none',
      flexShrink: 0,
      fontFamily: TYPOGRAPHY.fontFamilyMono,
      fontSize: TYPOGRAPHY.sizes.caption,
    }}>
      {n}
    </Box>
  )
}

function SplitPanel({ lines, language, hlStyle, isDark, side }) {
  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const label = side === 'before' ? 'Before' : 'After'
  const labelColor = side === 'before'
    ? (isDark ? '#f85149' : '#cf222e')
    : (isDark ? '#2ea043' : '#1a7f37')

  let lineNum = 0

  return (
    <Box sx={{ flex: 1, minWidth: 0, borderRight: side === 'before' ? `1px solid ${borderColor}` : 'none' }}>
      <Box sx={{
        px: 2, py: 0.75,
        borderBottom: `1px solid ${borderColor}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}>
        <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, fontWeight: TYPOGRAPHY.weights.semibold, color: labelColor }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        {lines.map((entry, i) => {
          const visible = side === 'before'
            ? entry.type !== 'insert'
            : entry.type !== 'delete'
          if (visible) lineNum++

          const bg = entry.type === 'delete' && side === 'before'
            ? (isDark ? 'rgba(248,81,73,0.15)' : 'rgba(207,34,46,0.08)')
            : entry.type === 'insert' && side === 'after'
              ? (isDark ? 'rgba(46,160,67,0.15)' : 'rgba(26,127,55,0.08)')
              : 'transparent'

          const borderLeft = entry.type === 'delete' && side === 'before'
            ? '3px solid #f85149'
            : entry.type === 'insert' && side === 'after'
              ? '3px solid #2ea043'
              : '3px solid transparent'

          if (!visible) {
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0, minHeight: 22, backgroundColor: 'transparent', borderLeft: '3px solid transparent' }}>
                <LineNumber n="" isDark={isDark} />
              </Box>
            )
          }

          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', backgroundColor: bg, borderLeft, pl: 1 }}>
              <LineNumber n={lineNum} isDark={isDark} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <SyntaxHighlighter
                  language={language}
                  style={hlStyle}
                  customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: TYPOGRAPHY.sizes.bodySm, fontFamily: TYPOGRAPHY.fontFamilyMono, lineHeight: String(TYPOGRAPHY.lineHeights.relaxed) }}
                  PreTag="div"
                  CodeTag="span"
                  useInlineStyles
                >
                  {entry.line}
                </SyntaxHighlighter>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function UnifiedView({ diff, language, hlStyle, isDark }) {
  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  let beforeNum = 0
  let afterNum  = 0

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{
        px: 2, py: 0.75,
        borderBottom: `1px solid ${borderColor}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}>
        <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, fontWeight: TYPOGRAPHY.weights.semibold, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
          Unified diff
        </Typography>
      </Box>
      {diff.map((entry, i) => {
        if (entry.type !== 'insert') beforeNum++
        if (entry.type !== 'delete') afterNum++

        const bg = entry.type === 'delete'
          ? (isDark ? 'rgba(248,81,73,0.15)' : 'rgba(207,34,46,0.08)')
          : entry.type === 'insert'
            ? (isDark ? 'rgba(46,160,67,0.15)' : 'rgba(26,127,55,0.08)')
            : 'transparent'

        const borderLeft = entry.type === 'delete'
          ? '3px solid #f85149'
          : entry.type === 'insert'
            ? '3px solid #2ea043'
            : '3px solid transparent'

        const prefix = entry.type === 'delete' ? '-' : entry.type === 'insert' ? '+' : ' '
        const prefixColor = entry.type === 'delete'
          ? '#f85149'
          : entry.type === 'insert'
            ? '#2ea043'
            : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'

        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', backgroundColor: bg, borderLeft, pl: 1 }}>
            <Box component="span" sx={{ minWidth: 28, textAlign: 'right', pr: 1, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontFamily: TYPOGRAPHY.fontFamilyMono, fontSize: TYPOGRAPHY.sizes.caption, userSelect: 'none', flexShrink: 0 }}>
              {entry.type !== 'insert' ? beforeNum : ''}
            </Box>
            <Box component="span" sx={{ minWidth: 28, textAlign: 'right', pr: 1.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontFamily: TYPOGRAPHY.fontFamilyMono, fontSize: TYPOGRAPHY.sizes.caption, userSelect: 'none', flexShrink: 0 }}>
              {entry.type !== 'delete' ? afterNum : ''}
            </Box>
            <Box component="span" sx={{ color: prefixColor, fontFamily: TYPOGRAPHY.fontFamilyMono, fontSize: TYPOGRAPHY.sizes.bodySm, pr: 1, flexShrink: 0, userSelect: 'none' }}>
              {prefix}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SyntaxHighlighter
                language={language}
                style={hlStyle}
                customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: TYPOGRAPHY.sizes.bodySm, fontFamily: TYPOGRAPHY.fontFamilyMono, lineHeight: String(TYPOGRAPHY.lineHeights.relaxed) }}
                PreTag="div"
                CodeTag="span"
                useInlineStyles
              >
                {entry.line}
              </SyntaxHighlighter>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export default function DiffViewer({
  before   = '',
  after    = '',
  language = 'python',
  mode     = 'split',
  caption,
}) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const hlStyle = isDark ? atomOneDark : atomOneLight

  const diff = useMemo(() => computeLineDiff(before, after), [before, after])

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const codeBg      = isDark ? '#0d1117' : '#f6f8fa'

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        backgroundColor: codeBg,
        '& .hljs': { background: 'transparent !important' },
      }}>
        {mode === 'split' ? (
          <Box sx={{ display: 'flex' }}>
            <SplitPanel lines={diff} language={language} hlStyle={hlStyle} isDark={isDark} side="before" />
            <SplitPanel lines={diff} language={language} hlStyle={hlStyle} isDark={isDark} side="after"  />
          </Box>
        ) : (
          <UnifiedView diff={diff} language={language} hlStyle={hlStyle} isDark={isDark} />
        )}
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
