import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Collapse } from '@mui/material'
import SearchOutlinedIcon        from '@mui/icons-material/SearchOutlined'
import CheckCircleOutlineIcon    from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon  from '@mui/icons-material/RadioButtonUnchecked'
import ChevronRightIcon          from '@mui/icons-material/ChevronRight'
import { fadeIn, softPulse }     from '../../theme/animations'
import { STAGE_REGISTRY, FALLBACK_STAGE_ICON } from '../../constants/stageRegistry'
import { safeHref }              from '../../utils/safeHref'
import { metaText, neutralBorderFaint, neutralToggle, shimmerTextSx } from '../../theme/styleUtils'
import {
  FrameSkeletonCards, SlideSkeletonCard, P5SkeletonCard,
  VideoSkeletonCard, BlockSkeletonPreview,
} from './LoadingSkeletons'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SHOWN_SOURCES  = 5
const BEATS_INITIAL_SHOW = 5

const ENTITY_LABELS = {
  slide_deck:       'Slides',
  p5_sketch:        'Animation',
  freeform_html:    'Widget',
  quiz_card:        'Quiz',
  timeline:         'Timeline',
  chart:            'Chart',
  mermaid:          'Diagram',
  map:              'Map',
  step_controls:    'Steps',
  code_walkthrough: 'Code',
  markdown_text:    'Text',
  flashcard_set:    'Flashcards',
}

// ── Research sub-items ────────────────────────────────────────────────────────

function DomainCircle({ domain, isDark }) {
  const initial = (domain || '?')[0].toUpperCase()
  return (
    <Box sx={{
      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{
        fontSize: 8, fontWeight: 700, lineHeight: 1,
        color: metaText(isDark),
      }}>
        {initial}
      </Typography>
    </Box>
  )
}

function QueryItem({ query, idx, isDark }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      py: 0.45, minWidth: 0,
      animation: `${fadeIn} 0.3s ease both`,
      animationDelay: `${idx * 0.18}s`,
    }}>
      <SearchOutlinedIcon sx={{
        fontSize: 11.5, flexShrink: 0,
        color: metaText(isDark),
      }} />
      <Typography sx={{
        fontSize: 12.5,
        color: isDark ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.45)',
        lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {query}
      </Typography>
    </Box>
  )
}

function SourceItem({ source, idx, isDark }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      py: 0.4,
      animation: `${fadeIn} 0.3s ease both`,
      animationDelay: `${idx * 0.14}s`,
    }}>
      <DomainCircle domain={source.domain} isDark={isDark} />
      <Box
        component="a"
        href={safeHref(source.url)}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          flex: 1, minWidth: 0,
          fontSize: 12.5, lineHeight: 1.4,
          color: isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: 'none',
          '&:hover': {
            color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.75)',
            textDecoration: 'underline',
          },
          transition: 'color 0.15s',
        }}
      >
        {source.title}
      </Box>
      <Typography sx={{
        fontSize: 10.5, flexShrink: 0,
        color: metaText(isDark),
      }}>
        {source.domain}
      </Typography>
    </Box>
  )
}

// ── Entity chips bar ──────────────────────────────────────────────────────────

export function EntityChipsBar({ entities, isDark }) {
  if (!entities?.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.25, ml: 3.5 }}>
      {entities.map((entity, i) => (
        <Box key={entity} sx={{
          px: 1, py: 0.3, borderRadius: '99px',
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.025em',
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${neutralToggle(isDark)}`,
          animation: `${fadeIn} 0.4s ease both`,
          animationDelay: `${i * 0.07}s`,
          userSelect: 'none',
        }}>
          {ENTITY_LABELS[entity] ?? entity}
        </Box>
      ))}
    </Box>
  )
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function ElapsedTimer({ isDark }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <Typography sx={{
      fontSize: 11, flexShrink: 0,
      color: metaText(isDark),
      fontVariantNumeric: 'tabular-nums',
      minWidth: 24, textAlign: 'right',
    }}>
      {secs}s
    </Typography>
  )
}

// ── Typewriter label ──────────────────────────────────────────────────────────

function TypewriterLabel({ label, isDark, isActive }) {
  const [displayed, setDisplayed] = useState(() => isActive ? '' : label)
  const prevLabelRef = useRef(isActive ? '' : label)

  useEffect(() => {
    if (!isActive) {
      setDisplayed(label)
      prevLabelRef.current = label
      return
    }
    if (label === prevLabelRef.current) return
    prevLabelRef.current = label
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(label.slice(0, i))
      if (i >= label.length) clearInterval(id)
    }, 18)
    return () => clearInterval(id)
  }, [label, isActive])

  return (
    <Typography sx={{
      flex: 1, minWidth: 0,
      fontSize: 13.5, fontWeight: 400,
      lineHeight: 1.4,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      ...(isActive ? shimmerTextSx(isDark) : {
        color: isDark
          ? (label === displayed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)')
          : (label === displayed ? 'rgba(0,0,0,0.30)'       : 'rgba(0,0,0,0.82)'),
        transition: 'color 0.3s',
      }),
    }}>
      {isActive ? displayed || label : label}
    </Typography>
  )
}

// ── Beat progress list ────────────────────────────────────────────────────────

function BeatRow({ title, isDone, isActive, isDark }) {
  const Icon      = isDone ? CheckCircleOutlineIcon : RadioButtonUncheckedIcon
  const iconColor = isDone ? metaText(isDark) : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)')

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.3 }}>
      <Icon sx={{ fontSize: 11, flexShrink: 0, color: iconColor }} />
      <Typography sx={{
        flex: 1, minWidth: 0,
        fontSize: 12.5, lineHeight: 1.5,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.4s',
        ...(isActive && !isDone
          ? shimmerTextSx(isDark)
          : {
              color: isDone
                ? metaText(isDark)
                : (isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.76)'),
            }
        ),
      }}>
        {title}
      </Typography>
    </Box>
  )
}

function BeatProgressList({ beatTitles, completedBeats, isDark }) {
  const [showAll, setShowAll] = useState(false)
  const completedSet = new Set(completedBeats ?? [])
  const activeIndex  = beatTitles.findIndex((_, i) => !completedSet.has(i))
  const visible      = showAll ? beatTitles : beatTitles.slice(0, BEATS_INITIAL_SHOW)
  const hiddenCount  = beatTitles.length - BEATS_INITIAL_SHOW

  return (
    <Box sx={{ mt: 0.75, mb: 0.5, pl: 1.5 }}>
      {visible.map((title, i) => (
        <BeatRow
          key={i} title={title}
          isDone={completedSet.has(i)}
          isActive={i === activeIndex}
          isDark={isDark}
        />
      ))}
      {!showAll && hiddenCount > 0 && (
        <Box
          component="button"
          onClick={() => setShowAll(true)}
          sx={{
            fontSize: 12, mt: 0.25,
            color: metaText(isDark),
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', p: 0,
            '&:hover': { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' },
            transition: 'color 0.15s',
          }}
        >
          +{hiddenCount} more
        </Box>
      )}
    </Box>
  )
}

// ── Single stage row ──────────────────────────────────────────────────────────

export function StageRow({ stage, sources, isLast, compact, isDark, beatTitles, completedBeats, blockCount }) {
  // Strip _r{N} round suffix (e.g. "searching_r2" → "searching") before registry lookup.
  const registryKey   = stage.id.startsWith('building_')
    ? 'building'
    : stage.id.replace(/_r\d+$/, '')
  const stageConfig   = STAGE_REGISTRY[registryKey]
  const IconComponent = stageConfig?.Icon ?? FALLBACK_STAGE_ICON
  const isActive  = stage.status === 'active'
  const isDone    = stage.status === 'done'
  const isPending = stage.status === 'pending'

  const isBuildingStage = registryKey === 'building'

  const iconColor = isActive  ? (isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)')
                  : isDone    ? metaText(isDark)
                              : (neutralBorderFaint(isDark))

  const lineColor = isDone
    ? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.11)')
    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')

  const queries = stage.queries ?? []

  const stageSources = (() => {
    if (!stageConfig?.hasSourceItems) return []
    // "reading" is the final summary — show every source across all rounds
    if (registryKey === 'reading') return sources
    // Round-based searching row — show only sources found in this specific round
    if (stage.round != null) return sources.filter(s => s._roundId === stage.id)
    // Any other hasSourceItems stage: show all (legacy behaviour)
    return sources
  })()

  // The backend labels the reading stage with the LLM-fed subset count (e.g. 10),
  // but the UI has the true total. Override the label so the number matches what we show.
  const displayLabel = (registryKey === 'reading' && sources.length > 0)
    ? `Reading ${sources.length} source${sources.length !== 1 ? 's' : ''}…`
    : stage.label

  const hasSubItems  = queries.length > 0 || stageSources.length > 0

  const [expanded, setExpanded] = useState(stage.status !== 'done')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stage.status === 'done') setExpanded(false)
  }, [stage.status])

  const [showAll, setShowAll] = useState(false)

  const skeletonType      = stageConfig?.skeleton
  const hasBeatData       = beatTitles && beatTitles.length > 0
  const showBeatList      = skeletonType === 'frames_or_beats' && isActive && hasBeatData
  const showFrameSkeleton = skeletonType === 'frames_or_beats' && isActive && !hasBeatData
  const showVideoSkeleton = skeletonType === 'video' && isActive
  const showBlockSkeleton = skeletonType === 'blocks' && isActive

  const entityType         = stage.entity_type
  const showSlidesSkeleton  = isBuildingStage && isActive && entityType === 'slide_deck'
  const showP5Skeleton      = isBuildingStage && isActive && entityType === 'p5_sketch'
  const showGenericSkeleton = isBuildingStage && isActive && !showSlidesSkeleton && !showP5Skeleton

  return (
    <Box sx={{
      display: 'flex', gap: 0,
      opacity: isPending ? 0.4 : 1,
      animation: !isPending ? `${fadeIn} 0.3s ease both` : 'none',
    }}>
      {/* Left track: icon + connector line */}
      <Box sx={{ width: 28, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{
          width: 28, height: compact ? 28 : 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          ...(isActive ? {
            '& svg': {
              filter: `drop-shadow(0 0 4px ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.28)'})`,
              animation: `${softPulse} 2.2s ease-in-out infinite`,
            }
          } : {}),
        }}>
          <IconComponent sx={{ fontSize: 15, color: iconColor, transition: 'color 0.3s' }} />
        </Box>
        {!isLast && (
          <Box sx={{
            width: '1px', flex: 1, minHeight: 10,
            backgroundColor: lineColor,
            transition: 'background-color 0.6s ease',
          }} />
        )}
      </Box>

      {/* Content area */}
      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : (compact ? 0.5 : 0.75), pl: 0.5 }}>
        {/* Stage header */}
        <Box
          onClick={hasSubItems ? () => setExpanded(v => !v) : undefined}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            minHeight: compact ? 28 : 32,
            cursor: hasSubItems ? 'pointer' : 'default',
            '&:hover': hasSubItems ? { opacity: 0.85 } : {},
            transition: 'opacity 0.15s',
          }}
        >
          <TypewriterLabel label={displayLabel} isDark={isDark} isActive={isActive} />

          {isActive && isBuildingStage && <ElapsedTimer isDark={isDark} />}

          {showBeatList && completedBeats != null && beatTitles?.length > 0 && (
            <Typography sx={{
              fontSize: 11, flexShrink: 0,
              color: metaText(isDark),
              mr: 0.5,
            }}>
              {completedBeats.length} / {beatTitles.length}
            </Typography>
          )}

          {isDone && stage.duration_s != null && stage.duration_s > 0 && (
            <Typography sx={{
              fontSize: 11, flexShrink: 0,
              color: metaText(isDark),
              mr: hasSubItems ? 0.25 : 0,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {stage.duration_s}s
            </Typography>
          )}

          {hasSubItems ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', flexShrink: 0,
              color: metaText(isDark),
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}>
              <ChevronRightIcon sx={{ fontSize: 14 }} />
            </Box>
          ) : isActive ? (
            <ChevronRightIcon sx={{
              fontSize: 13, flexShrink: 0,
              color: metaText(isDark),
            }} />
          ) : null}
        </Box>

        {/* Block count sub-label for planning stage */}
        {stage.id === 'planning' && isDone && blockCount > 0 && (
          <Typography sx={{
            fontSize: 11, mt: 0.15, mb: 0.25,
            color: metaText(isDark),
            animation: `${fadeIn} 0.4s ease both`,
          }}>
            {blockCount} block{blockCount !== 1 ? 's' : ''} planned
          </Typography>
        )}

        {/* Skeleton previews */}
        {showBeatList      && <BeatProgressList beatTitles={beatTitles} completedBeats={completedBeats} isDark={isDark} />}
        {showFrameSkeleton && <FrameSkeletonCards isDark={isDark} />}
        {showVideoSkeleton && <VideoSkeletonCard isDark={isDark} />}
        {showBlockSkeleton && <BlockSkeletonPreview isDark={isDark} />}
        {showSlidesSkeleton  && <SlideSkeletonCard isDark={isDark} />}
        {showP5Skeleton      && <P5SkeletonCard isDark={isDark} />}
        {showGenericSkeleton && <BlockSkeletonPreview isDark={isDark} />}

        {/* Research sub-items */}
        {hasSubItems && (
          <Collapse in={expanded} timeout={180}>
            <Box sx={{ mt: 0.5, mb: 0.75, pl: 1.25, borderLeft: `1.5px solid ${lineColor}`, ml: 0.25, overflow: 'hidden' }}>
              {queries.map((q, i) => <QueryItem key={i} query={q} idx={i} isDark={isDark} />)}
              {queries.length > 0 && stageSources.length > 0 && <Box sx={{ height: 6 }} />}
              {(showAll ? stageSources : stageSources.slice(0, MAX_SHOWN_SOURCES)).map((s, i) => (
                <SourceItem key={s.url ?? i} source={s} idx={i} isDark={isDark} />
              ))}
              {!showAll && stageSources.length > MAX_SHOWN_SOURCES && (
                <Box component="button" onClick={() => setShowAll(true)} sx={{
                  fontSize: 12, mt: 0.5, pl: 0.25,
                  color: metaText(isDark),
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', p: 0,
                  '&:hover': { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' },
                  transition: 'color 0.15s',
                }}>
                  +{stageSources.length - MAX_SHOWN_SOURCES} more
                </Box>
              )}
            </Box>
          </Collapse>
        )}
      </Box>
    </Box>
  )
}
