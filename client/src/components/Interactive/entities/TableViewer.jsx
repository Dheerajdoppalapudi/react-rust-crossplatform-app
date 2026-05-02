import { useState, useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'

function SortIcon({ dir }) {
  return (
    <Box component="span" sx={{ ml: 0.5, opacity: 0.7, fontSize: 10 }}>
      {dir === 'asc' ? '▲' : '▼'}
    </Box>
  )
}

export default function TableViewer({
  columns       = [],
  rows          = [],
  sortable      = true,
  striped       = true,
  highlightRows = [],
  caption,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const handleSort = (key) => {
    if (!sortable) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const headerBg    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const mutedText   = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.4)'
  const bodyText    = isDark ? PALETTE.warmSilver        : PALETTE.nearBlackText

  const gridCols = columns.map(c => c.width ?? '1fr').join(' ')

  return (
    <Box>
      <Box sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          backgroundColor: headerBg,
          borderBottom: `1px solid ${borderColor}`,
        }}>
          {columns.map(col => (
            <Box
              key={col.key}
              onClick={() => handleSort(col.key)}
              sx={{
                px: 2, py: 1.25,
                cursor: sortable ? 'pointer' : 'default',
                userSelect: 'none',
                display: 'flex', alignItems: 'center',
                '&:hover': sortable ? { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' } : {},
              }}
            >
              <Typography sx={{
                fontSize: TYPOGRAPHY.sizes.caption,
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: mutedText,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1,
              }}>
                {col.label}
              </Typography>
              {sortable && sortKey === col.key && <SortIcon dir={sortDir} />}
            </Box>
          ))}
        </Box>

        {/* Rows */}
        {sortedRows.map((row, i) => {
          const isHighlighted = highlightRows.includes(i)
          const isStriped     = striped && i % 2 === 1

          return (
            <Box
              key={i}
              sx={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                borderBottom: i < sortedRows.length - 1 ? `1px solid ${borderColor}` : 'none',
                backgroundColor: isHighlighted
                  ? (isDark ? 'rgba(75,114,255,0.1)' : 'rgba(75,114,255,0.06)')
                  : isStriped
                    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                    : 'transparent',
                borderLeft: isHighlighted ? `3px solid #4B72FF` : '3px solid transparent',
              }}
            >
              {columns.map(col => (
                <Box key={col.key} sx={{ px: 2, py: 1.25 }}>
                  <Typography sx={{
                    fontSize: TYPOGRAPHY.sizes.bodySm,
                    color: bodyText,
                    lineHeight: TYPOGRAPHY.lineHeights.normal,
                  }}>
                    {row[col.key] ?? '—'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )
        })}
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
