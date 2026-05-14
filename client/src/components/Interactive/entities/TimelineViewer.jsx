import { useMemo, useState, useRef, useCallback } from 'react'
import { Box, Typography, Chip, Tooltip, IconButton, useTheme } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import ZoomInIcon    from '@mui/icons-material/ZoomIn'
import ZoomOutIcon   from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'

const MotionDiv = motion.div
import { useSceneStore } from '../useSceneStore'
import { useExpanded } from '../BlockWrapper'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

const MIN_ZOOM  = 0.5
const MAX_ZOOM  = 2.5
const ZOOM_STEP = 0.25

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ event, side, orientation, index, compact, zoom = 1 }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const color  = event.color ?? BRAND.primary

  const variants = orientation === 'vertical'
    ? {
        hidden:  { opacity: 0, x: side === 'left' ? -24 : 24 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut', delay: index * 0.06 } },
      }
    : {
        hidden:  { opacity: 0, y: side === 'top' ? -20 : 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut', delay: index * 0.06 } },
      }

  // Scale card widths with zoom for horizontal layout only
  const hMax = (compact ? 160 : 220) * zoom
  const hMin = (compact ? 110 : 160) * zoom

  return (
    <MotionDiv variants={variants} initial="hidden" animate="visible">
      <Box sx={{
        borderLeft: `3px solid ${color}`,
        borderRadius: `0 ${RADIUS.md}px ${RADIUS.md}px 0`,
        backgroundColor: isDark ? `${color}14` : `${color}0d`,
        px: compact ? 1.25 : 2,
        py: compact ? 0.75 : 1.5,
        maxWidth: orientation === 'horizontal' ? hMax : (compact ? 220 : 280),
        minWidth: orientation === 'horizontal' ? hMin : (compact ? 130 : 180),
      }}>
        {!compact && event.icon && (
          <Typography sx={{ fontSize: '1.3rem', lineHeight: 1.2, mb: 0.5 }}>{event.icon}</Typography>
        )}
        <Typography sx={{
          fontSize: TYPOGRAPHY.sizes.caption,
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: color,
          letterSpacing: TYPOGRAPHY.letterSpacing?.wide ?? '0.04em',
          textTransform: 'uppercase',
          mb: 0.25,
        }}>
          {compact && event.icon ? `${event.icon} ${event.date}` : event.date}
        </Typography>
        <Typography sx={{
          fontSize: compact ? TYPOGRAPHY.sizes.caption : (TYPOGRAPHY.sizes.bodySm ?? '0.8125rem'),
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: isDark ? PALETTE.warmSilver : PALETTE.nearBlackText,
          mb: compact ? 0 : 0.5,
          lineHeight: 1.3,
          ...(compact ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
        }}>
          {event.title}
        </Typography>
        {!compact && event.description && (
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            lineHeight: 1.45,
          }}>
            {event.description}
          </Typography>
        )}
      </Box>
    </MotionDiv>
  )
}

// ── SpineDot ──────────────────────────────────────────────────────────────────

function SpineDot({ color }) {
  return (
    <Box sx={{
      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
      backgroundColor: color ?? BRAND.primary,
      border: '2px solid',
      borderColor: 'background.paper',
      boxShadow: `0 0 0 2px ${color ?? BRAND.primary}44`,
      zIndex: 1,
    }} />
  )
}

// ── VerticalTimeline ──────────────────────────────────────────────────────────

function VerticalTimeline({ events, compact, zoom = 1, eraColor = null }) {
  const spineColor = eraColor ? `${eraColor}55` : 'divider'

  return (
    <Box sx={{
      position: 'relative', px: 2, py: 1,
      ...(eraColor ? {
        backgroundColor: `${eraColor}08`,
        borderRadius: `${RADIUS.md}px`,
        mx: -1, px: 3,
      } : {}),
    }}>
      <Box sx={{
        position: 'absolute', left: '50%', top: 0, bottom: 0,
        width: 2, transform: 'translateX(-50%)',
        backgroundColor: spineColor,
      }} />
      {events.map((event, i) => {
        const side = i % 2 === 0 ? 'left' : 'right'
        return (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center',
            mb: `${(compact ? 1.5 : 3) * zoom}rem`,
            flexDirection: side === 'left' ? 'row' : 'row-reverse',
          }}>
            <Box sx={{
              flex: 1, display: 'flex',
              justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
              pr: side === 'left' ? 2 : 0,
              pl: side === 'right' ? 2 : 0,
            }}>
              <EventCard event={event} side={side} orientation="vertical" index={i} compact={compact} zoom={zoom} />
            </Box>
            <SpineDot color={event.color ?? eraColor ?? undefined} />
            <Box sx={{ flex: 1 }} />
          </Box>
        )
      })}
    </Box>
  )
}

// ── HorizontalTimeline ────────────────────────────────────────────────────────

function HorizontalTimeline({ events, compact, zoom = 1, eraColor = null }) {
  const cardWidth  = (compact ? 140 : 220) * zoom
  const spineColor = eraColor ? `${eraColor}55` : 'divider'

  return (
    <Box sx={{
      pb: 1,
      ...(eraColor ? {
        backgroundColor: `${eraColor}08`,
        borderRadius: `${RADIUS.sm}px`,
        px: 1, pt: 0.5,
      } : {}),
    }}>
      <Box sx={{
        position: 'relative', display: 'flex', alignItems: 'center',
        minWidth: events.length * cardWidth, py: 2,
      }}>
        <Box sx={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 2, backgroundColor: spineColor, transform: 'translateY(-50%)',
        }} />
        {events.map((event, i) => {
          const side = i % 2 === 0 ? 'top' : 'bottom'
          return (
            <Box key={i} sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, position: 'relative', minWidth: cardWidth,
            }}>
              {side === 'top' && (
                <Box sx={{ mb: 1 }}>
                  <EventCard event={event} side="top" orientation="horizontal" index={i} compact={compact} zoom={zoom} />
                </Box>
              )}
              <SpineDot color={event.color ?? eraColor ?? undefined} />
              {side === 'bottom' && (
                <Box sx={{ mt: 1 }}>
                  <EventCard event={event} side="bottom" orientation="horizontal" index={i} compact={compact} zoom={zoom} />
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
        <Typography sx={{ fontSize: 10, opacity: 0.3, letterSpacing: '0.05em' }}>← scroll →</Typography>
      </Box>
    </Box>
  )
}

// ── CategoryHeader ────────────────────────────────────────────────────────────

function CategoryHeader({ label, isDark }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2 }}>
      <Box sx={{ flex: 1, height: 1, backgroundColor: 'divider' }} />
      <Chip
        label={label}
        size="small"
        sx={{
          fontSize: TYPOGRAPHY.sizes.caption,
          fontWeight: TYPOGRAPHY.weights.semibold,
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
        }}
      />
      <Box sx={{ flex: 1, height: 1, backgroundColor: 'divider' }} />
    </Box>
  )
}

// ── EraHeader ─────────────────────────────────────────────────────────────────

function EraHeader({ label, color }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 1.5 }}>
      <Box sx={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: `${color}44` }} />
      <Chip
        label={label}
        size="small"
        sx={{
          fontSize: TYPOGRAPHY.sizes.caption,
          fontWeight: TYPOGRAPHY.weights.semibold,
          backgroundColor: `${color}18`,
          color: color,
          border: `1px solid ${color}44`,
        }}
      />
      <Box sx={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: `${color}44` }} />
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TimelineViewer({
  entityId,
  events       = [],
  orientation  = 'vertical',
  stepReveal   = false,
  groupBy,
  eras,           // [{label, key, color}] — era period shading
  compact      = false,
  caption,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  const [zoom, setZoom] = useState(1)
  const scrollRef       = useRef(null)

  const stepIndex = useSceneStore(s => s.getStep(entityId))

  const visibleEvents = useMemo(() => {
    if (!stepReveal) return events
    return events.slice(0, stepIndex + 1)
  }, [events, stepReveal, stepIndex])

  // Era lookup map
  const eraMap = useMemo(() => {
    if (!eras?.length) return {}
    return Object.fromEntries(eras.map(e => [e.key, e]))
  }, [eras])

  // Group events into sections
  const sections = useMemo(() => {
    // Era grouping: group by event.era field, ordered by the eras prop array
    if (eras?.length) {
      const buckets = {}
      for (const era of eras) buckets[era.key] = []
      buckets['__other__'] = []

      for (const ev of visibleEvents) {
        const key = ev.era ?? '__other__'
        if (!buckets[key]) buckets[key] = []
        buckets[key].push(ev)
      }

      const result = eras
        .filter(era => buckets[era.key]?.length > 0)
        .map(era => ({ label: era.label, events: buckets[era.key], eraColor: era.color }))

      if (buckets['__other__'].length > 0) {
        result.push({ label: 'Other', events: buckets['__other__'], eraColor: null })
      }
      return result
    }

    // Standard groupBy
    if (!groupBy) return [{ label: null, events: visibleEvents, eraColor: null }]

    const groups = {}
    const order  = []
    for (const ev of visibleEvents) {
      const key = ev[groupBy] ?? 'Other'
      if (!groups[key]) { groups[key] = []; order.push(key) }
      groups[key].push(ev)
    }
    return order.map(k => ({ label: k, events: groups[k], eraColor: null }))
  }, [visibleEvents, groupBy, eras])

  // Ctrl/Cmd + scroll to zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setZoom(z => {
        const next = z - e.deltaY * 0.003
        return +Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)).toFixed(2)
      })
    }
  }, [])

  if (!events.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        timeline: "events" array is required
      </Box>
    )
  }

  const atMin = zoom <= MIN_ZOOM
  const atMax = zoom >= MAX_ZOOM

  return (
    <Box>
      <Box sx={{
        border: isExpanded ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        overflow: 'hidden',
      }}>
        {/* ── Zoom toolbar ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25,
          px: 1, py: 0.5,
          borderBottom: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
        }}>
          <Tooltip title="Zoom out (or Ctrl+scroll)">
            <span>
              <IconButton size="small" onClick={() => setZoom(z => +Math.max(MIN_ZOOM, z - ZOOM_STEP).toFixed(2))}
                disabled={atMin} sx={{ color: 'text.secondary', width: 26, height: 26 }}>
                <ZoomOutIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Typography sx={{ fontSize: 11, color: 'text.disabled', minWidth: 36, textAlign: 'center', userSelect: 'none' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="Zoom in (or Ctrl+scroll)">
            <span>
              <IconButton size="small" onClick={() => setZoom(z => +Math.min(MAX_ZOOM, z + ZOOM_STEP).toFixed(2))}
                disabled={atMax} sx={{ color: 'text.secondary', width: 26, height: 26 }}>
                <ZoomInIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reset zoom">
            <span>
              <IconButton size="small" onClick={() => setZoom(1)} disabled={zoom === 1}
                sx={{ color: 'text.secondary', width: 26, height: 26 }}>
                <FitScreenIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* ── Timeline content ── */}
        <Box
          ref={scrollRef}
          onWheel={handleWheel}
          sx={{
            p: isExpanded ? 3 : 2,
            overflowX: orientation === 'horizontal' ? 'auto' : 'hidden',
            overflowY: 'auto',
          }}
        >
          <AnimatePresence>
            {sections.map((section, si) => (
              <Box key={si}>
                {section.label && section.eraColor
                  ? <EraHeader label={section.label} color={section.eraColor} />
                  : section.label
                    ? <CategoryHeader label={section.label} isDark={isDark} />
                    : null
                }
                {orientation === 'vertical'
                  ? <VerticalTimeline   events={section.events} compact={compact} zoom={zoom} eraColor={section.eraColor} />
                  : <HorizontalTimeline events={section.events} compact={compact} zoom={zoom} eraColor={section.eraColor} />
                }
              </Box>
            ))}
          </AnimatePresence>
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
