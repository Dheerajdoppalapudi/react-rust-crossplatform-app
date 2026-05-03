import { useState, useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { TYPOGRAPHY, RADIUS, PALETTE } from '../../../theme/tokens'
import { useExpanded } from '../BlockWrapper'

function SortIcon({ dir }) {
  return (
    <Box component="span" sx={{ ml: 0.5, opacity: 0.7, fontSize: 10 }}>
      {dir === 'asc' ? '▲' : '▼'}
    </Box>
  )
}

function CellValue({ value, isDark }) {
  // Support rich cell objects: { text, badge, color }
  if (value !== null && typeof value === 'object' && value.text !== undefined) {
    return (
      <Box sx={{
        display: 'inline-flex', alignItems: 'center',
        px: 1, py: 0.25,
        borderRadius: '4px',
        backgroundColor: value.color ? `${value.color}22` : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        border: value.color ? `1px solid ${value.color}55` : 'none',
      }}>
        <Typography sx={{
          fontSize: TYPOGRAPHY.sizes.caption,
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: value.color ?? (isDark ? PALETTE.warmSilver : PALETTE.nearBlackText),
          lineHeight: 1,
        }}>
          {value.text}
        </Typography>
      </Box>
    )
  }
  return (
    <Typography sx={{
      fontSize: TYPOGRAPHY.sizes.bodySm,
      color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
      lineHeight: TYPOGRAPHY.lineHeights.normal,
    }}>
      {value ?? '—'}
    </Typography>
  )
}

export default function TableViewer({
  columns       = [],
  rows          = [],
  sortable      = true,
  striped       = true,
  highlightRows = [],
  searchable    = false,
  maxHeight,
  caption,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  const [sortKey,     setSortKey]     = useState(null)
  const [sortDir,     setSortDir]     = useState('asc')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter(row =>
      columns.some(col => {
        const v = row[col.key]
        if (v === null || v === undefined) return false
        const text = typeof v === 'object' ? (v.text ?? '') : String(v)
        return text.toLowerCase().includes(q)
      })
    )
  }, [rows, columns, searchQuery])

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = typeof a[sortKey] === 'object' ? (a[sortKey]?.text ?? '') : (a[sortKey] ?? '')
      const bv = typeof b[sortKey] === 'object' ? (b[sortKey]?.text ?? '') : (b[sortKey] ?? '')
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortKey, sortDir])

  const handleSort = (key) => {
    if (!sortable) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const borderColor = isDark ? PALETTE.borderDark : PALETTE.borderCream
  const headerBg    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const mutedText   = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.4)'

  // Each column gets a floor of 120px; honour explicit widths as min-width
  const gridCols = columns.map(c => c.width ? `minmax(${c.width}, 1fr)` : 'minmax(120px, 1fr)').join(' ')

  return (
    <Box>
      {searchable && (
        <Box sx={{ mb: 1 }}>
          <Box
            component="input"
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{
              width: '100%',
              px: 1.5, py: 0.875,
              fontSize: TYPOGRAPHY.sizes.bodySm,
              fontFamily: 'inherit',
              border: `1px solid ${borderColor}`,
              borderRadius: `${RADIUS.md}px`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
              outline: 'none',
              boxSizing: 'border-box',
              '&::placeholder': { color: mutedText },
              '&:focus': { borderColor: '#4B72FF' },
            }}
          />
        </Box>
      )}

      <Box sx={{
        border: isExpanded ? 'none' : `1px solid ${borderColor}`,
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        overflow: 'hidden',
      }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 'max-content', width: '100%' }}>

            {/* Header — sticky when maxHeight is set */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              backgroundColor: headerBg,
              borderBottom: `1px solid ${borderColor}`,
              ...(maxHeight ? { position: 'sticky', top: 0, zIndex: 1 } : {}),
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
                    whiteSpace: 'nowrap',
                  }}>
                    {col.label}
                  </Typography>
                  {sortable && sortKey === col.key && <SortIcon dir={sortDir} />}
                </Box>
              ))}
            </Box>

            {/* Rows */}
            <Box sx={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}>
              {sortedRows.length === 0 ? (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: mutedText }}>
                    {searchQuery ? 'No results match your search.' : 'No rows.'}
                  </Typography>
                </Box>
              ) : sortedRows.map((row, i) => {
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
                      borderLeft: isHighlighted ? '3px solid #4B72FF' : '3px solid transparent',
                    }}
                  >
                    {columns.map(col => (
                      <Box key={col.key} sx={{ px: 2, py: 1.25 }}>
                        <CellValue value={row[col.key]} isDark={isDark} />
                      </Box>
                    ))}
                  </Box>
                )
              })}
            </Box>

          </Box>
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
