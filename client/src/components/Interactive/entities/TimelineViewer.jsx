import { useMemo } from 'react'
import { Box, Typography, Chip, useTheme } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'

const MotionDiv = motion.div
import { useSceneStore } from '../useSceneStore'
import { useExpanded } from '../BlockWrapper'
import { TYPOGRAPHY, RADIUS, PALETTE, BRAND } from '../../../theme/tokens'

function EventCard({ event, side, orientation, index, compact }) {
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

  return (
    <MotionDiv variants={variants} initial="hidden" animate="visible">
      <Box sx={{
        borderLeft: `3px solid ${color}`,
        borderRadius: `0 ${RADIUS.md}px ${RADIUS.md}px 0`,
        backgroundColor: isDark ? `${color}14` : `${color}0d`,
        px: compact ? 1.25 : 2,
        py: compact ? 0.75 : 1.5,
        maxWidth: orientation === 'vertical' ? (compact ? 220 : 280) : (compact ? 160 : 220),
        minWidth: orientation === 'vertical' ? (compact ? 130 : 180) : (compact ? 110 : 160),
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

function VerticalTimeline({ events, compact }) {
  return (
    <Box sx={{ position: 'relative', px: 2, py: 1 }}>
      <Box sx={{
        position: 'absolute', left: '50%', top: 0, bottom: 0,
        width: 2, transform: 'translateX(-50%)',
        backgroundColor: 'divider',
      }} />
      {events.map((event, i) => {
        const side = i % 2 === 0 ? 'left' : 'right'
        return (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center', mb: compact ? 1.5 : 3,
            flexDirection: side === 'left' ? 'row' : 'row-reverse',
          }}>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start', pr: side === 'left' ? 2 : 0, pl: side === 'right' ? 2 : 0 }}>
              <EventCard event={event} side={side} orientation="vertical" index={i} compact={compact} />
            </Box>
            <SpineDot color={event.color} />
            <Box sx={{ flex: 1 }} />
          </Box>
        )
      })}
    </Box>
  )
}

function HorizontalTimeline({ events, compact }) {
  const cardWidth = compact ? 140 : 220
  return (
    <Box sx={{ pb: 1 }}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: events.length * cardWidth, py: 2 }}>
        <Box sx={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 2, backgroundColor: 'divider', transform: 'translateY(-50%)',
        }} />
        {events.map((event, i) => {
          const side = i % 2 === 0 ? 'top' : 'bottom'
          return (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
              {side === 'top' && (
                <Box sx={{ mb: 1 }}>
                  <EventCard event={event} side="top" orientation="horizontal" index={i} compact={compact} />
                </Box>
              )}
              <SpineDot color={event.color} />
              {side === 'bottom' && (
                <Box sx={{ mt: 1 }}>
                  <EventCard event={event} side="bottom" orientation="horizontal" index={i} compact={compact} />
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
      {/* Scroll hint */}
      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
        <Typography sx={{ fontSize: 10, opacity: 0.3, letterSpacing: '0.05em' }}>← scroll →</Typography>
      </Box>
    </Box>
  )
}

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

export default function TimelineViewer({
  entityId,
  events       = [],
  orientation  = 'vertical',
  stepReveal   = false,
  groupBy,
  compact      = false,
  caption,
}) {
  const theme      = useTheme()
  const isDark     = theme.palette.mode === 'dark'
  const isExpanded = useExpanded()

  const stepIndex = useSceneStore(s => s.getStep(entityId))

  const visibleEvents = useMemo(() => {
    if (!stepReveal) return events
    return events.slice(0, stepIndex + 1)
  }, [events, stepReveal, stepIndex])

  // Group events if groupBy is specified — must be before any early return
  const sections = useMemo(() => {
    if (!groupBy) return [{ label: null, events: visibleEvents }]
    const groups = {}
    const order  = []
    for (const ev of visibleEvents) {
      const key = ev[groupBy] ?? 'Other'
      if (!groups[key]) { groups[key] = []; order.push(key) }
      groups[key].push(ev)
    }
    return order.map(k => ({ label: k, events: groups[k] }))
  }, [visibleEvents, groupBy])

  if (!events.length) {
    return (
      <Box sx={{ p: 2, color: 'error.main', fontSize: TYPOGRAPHY.sizes.caption }}>
        timeline: "events" array is required
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{
        border: isExpanded ? 'none' : `1px solid ${isDark ? PALETTE.borderDark : PALETTE.borderCream}`,
        borderRadius: isExpanded ? 0 : `${RADIUS.lg}px`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        p: isExpanded ? 3 : 2,
        overflow: 'hidden',
        overflowX: orientation === 'horizontal' ? 'auto' : 'hidden',
      }}>
        <AnimatePresence>
          {sections.map((section, si) => (
            <Box key={si}>
              {section.label && <CategoryHeader label={section.label} isDark={isDark} />}
              {orientation === 'vertical'
                ? <VerticalTimeline    events={section.events} compact={compact} />
                : <HorizontalTimeline  events={section.events} compact={compact} />
              }
            </Box>
          ))}
        </AnimatePresence>
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
