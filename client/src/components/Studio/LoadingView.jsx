import { useState, useEffect } from 'react'
import { Box, Typography, Collapse, useTheme } from '@mui/material'
import LightbulbOutlinedIcon        from '@mui/icons-material/LightbulbOutlined'
import TravelExploreOutlinedIcon    from '@mui/icons-material/TravelExploreOutlined'
import ArticleOutlinedIcon          from '@mui/icons-material/ArticleOutlined'
import AutoFixHighOutlinedIcon      from '@mui/icons-material/AutoFixHighOutlined'
import AccountTreeOutlinedIcon      from '@mui/icons-material/AccountTreeOutlined'
import DashboardOutlinedIcon        from '@mui/icons-material/DashboardOutlined'
import GridViewOutlinedIcon         from '@mui/icons-material/GridViewOutlined'
import MovieCreationOutlinedIcon    from '@mui/icons-material/MovieCreationOutlined'
import BurstModeOutlinedIcon        from '@mui/icons-material/BurstModeOutlined'
import PhotoFilterOutlinedIcon      from '@mui/icons-material/PhotoFilterOutlined'
import SearchOutlinedIcon           from '@mui/icons-material/SearchOutlined'
import CheckCircleOutlineIcon       from '@mui/icons-material/CheckCircleOutline'
import KeyboardArrowDownIcon        from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon          from '@mui/icons-material/KeyboardArrowUp'
import RadioButtonUncheckedIcon     from '@mui/icons-material/RadioButtonUnchecked'
import { pulse, fadeIn, shimmer } from '../../theme/animations'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SHOWN_SOURCES = 5
const FRAME_COUNT       = 5
const FRAME_INDICES     = Array.from({ length: FRAME_COUNT }, (_, i) => i)

// ── Stage icon map ────────────────────────────────────────────────────────────

const STAGE_ICONS = {
  thinking:          LightbulbOutlinedIcon,
  decomposing:       LightbulbOutlinedIcon,
  searching:         TravelExploreOutlinedIcon,
  reading:           ArticleOutlinedIcon,
  synthesising:      AutoFixHighOutlinedIcon,
  planning:          AccountTreeOutlinedIcon,
  designing:         DashboardOutlinedIcon,
  generating_frames: GridViewOutlinedIcon,
  generating:        GridViewOutlinedIcon,
  rendering:         PhotoFilterOutlinedIcon,
  frames:            BurstModeOutlinedIcon,
  video:             MovieCreationOutlinedIcon,
}

// ── Skeleton helpers (visual generation stages) ───────────────────────────────

function shimmerBg(isDark) { return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }
function skeletonBg(isDark) { return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }

function ShimmerOverlay({ isDark, delay = 0 }) {
  return (
    <Box sx={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(90deg, transparent 0%, ${shimmerBg(isDark)} 50%, transparent 100%)`,
      animation: `${shimmer} 1.7s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }} />
  )
}

function FrameSkeletonCards({ isDark }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
      {FRAME_INDICES.map((i) => (
        <Box key={i} sx={{
          width: 68, height: 50, borderRadius: '6px',
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative', flexShrink: 0,
          animation: `${fadeIn} 0.4s ease both`,
          animationDelay: `${i * 0.1}s`,
        }}>
          <ShimmerOverlay isDark={isDark} delay={i * 0.18} />
          <Typography sx={{
            position: 'absolute', bottom: 3, right: 4,
            fontSize: 8, fontWeight: 600, userSelect: 'none',
            color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
          }}>
            {i + 1}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}


function VideoSkeletonCard({ isDark }) {
  return (
    <Box sx={{
      width: '100%', maxWidth: 280, aspectRatio: '16/9', borderRadius: '8px',
      backgroundColor: skeletonBg(isDark), overflow: 'hidden', position: 'relative',
      mt: 1.5, mb: 0.5, animation: `${fadeIn} 0.4s ease both`,
    }}>
      <ShimmerOverlay isDark={isDark} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MovieCreationOutlinedIcon sx={{ fontSize: 28, opacity: 0.1, color: isDark ? '#fff' : '#000' }} />
      </Box>
    </Box>
  )
}

function BlockSkeletonPreview({ isDark }) {
  const BLOCKS = [
    { type: 'text',   lines: [1, 0.82, 0.58] },
    { type: 'entity', lines: []               },
    { type: 'text',   lines: [1, 0.68]        },
  ]
  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 320 }}>
      {BLOCKS.map((block, i) => (
        <Box key={i} sx={{
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          backgroundColor: skeletonBg(isDark),
          overflow: 'hidden', position: 'relative',
          animation: `${fadeIn} 0.5s ease both`,
          animationDelay: `${i * 0.2}s`,
        }}>
          <ShimmerOverlay isDark={isDark} delay={i * 0.25} />
          {block.type === 'text' ? (
            <Box sx={{ px: 1.5, py: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {block.lines.map((w, li) => (
                <Box key={li} sx={{
                  height: 7, borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  width: `${w * 100}%`,
                }} />
              ))}
            </Box>
          ) : (
            <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ opacity: 0.08, display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ width: 28, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
                  <Box sx={{ width: 28, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
                </Box>
                <Box sx={{ width: 2, height: 14, backgroundColor: isDark ? '#fff' : '#000' }} />
                <Box sx={{ width: 52, height: 18, borderRadius: '4px', backgroundColor: isDark ? '#fff' : '#000' }} />
              </Box>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

// ── Research sub-item components ──────────────────────────────────────────────

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
        color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)',
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
      animation: `${fadeIn} 0.25s ease both`,
      animationDelay: `${idx * 0.06}s`,
    }}>
      <SearchOutlinedIcon sx={{
        fontSize: 11.5, flexShrink: 0,
        color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)',
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
      animation: `${fadeIn} 0.25s ease both`,
      animationDelay: `${idx * 0.05}s`,
    }}>
      <DomainCircle domain={source.domain} isDark={isDark} />
      <Box
        component="a"
        href={source.url}
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
        color: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)',
      }}>
        {source.domain}
      </Typography>
    </Box>
  )
}

// ── Single stage row ──────────────────────────────────────────────────────────

function StageRow({ stage, sources, isLast, compact, isDark }) {
  const IconComponent = STAGE_ICONS[stage.id] ?? RadioButtonUncheckedIcon
  const isActive  = stage.status === 'active'
  const isDone    = stage.status === 'done'
  const isPending = stage.status === 'pending'

  const iconColor = isActive  ? (isDark ? 'rgba(75,114,255,0.58)'  : 'rgba(24,71,214,0.48)')
                  : isDone    ? (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)')
                              : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')

  const textColor = isActive  ? (isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)')
                  : isDone    ? (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)')
                              : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)')

  const lineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  const queries      = stage.queries ?? []
  const stageSources = (stage.id === 'searching' || stage.id === 'reading') ? sources : []
  const hasSubItems  = queries.length > 0 || stageSources.length > 0

  const [expanded, setExpanded] = useState(stage.status !== 'done')
  useEffect(() => {
    if (stage.status === 'done') setExpanded(false)
  }, [stage.status])

  const [showAll, setShowAll] = useState(false)

  const showFrameSkeleton = (stage.id === 'generating_frames' || stage.id === 'generating' || stage.id === 'rendering' || stage.id === 'frames') && isActive
  const showVideoSkeleton = stage.id === 'video' && isActive
  const showBlockSkeleton = stage.id === 'designing' && isActive

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
        }}>
          <IconComponent sx={{
            fontSize: 15, color: iconColor,
            ...(isActive ? { animation: `${pulse} 2s ease-in-out infinite` } : {}),
          }} />
        </Box>
        {!isLast && (
          <Box sx={{ width: '1px', flex: 1, minHeight: 10, backgroundColor: lineColor }} />
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
          <Typography sx={{
            flex: 1, minWidth: 0,
            fontSize: 13, fontWeight: 400,
            color: textColor,
            lineHeight: 1.4,
            transition: 'color 0.3s',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {stage.label}
          </Typography>

          {isDone && stage.duration_s != null && (
            <Typography sx={{
              fontSize: 11, flexShrink: 0,
              color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              mr: hasSubItems ? 0.25 : 0,
            }}>
              {stage.duration_s}s
            </Typography>
          )}

          {hasSubItems && (
            <Box sx={{ display: 'flex', alignItems: 'center', color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>
              {expanded ? <KeyboardArrowUpIcon sx={{ fontSize: 14 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />}
            </Box>
          )}
        </Box>

        {/* Skeleton previews (live only) */}
        {showFrameSkeleton && <FrameSkeletonCards isDark={isDark} />}
        {showVideoSkeleton && <VideoSkeletonCard isDark={isDark} />}
        {showBlockSkeleton && <BlockSkeletonPreview isDark={isDark} />}

        {/* Research sub-items (live only) */}
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
                  color: isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)',
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

// ── Main component ────────────────────────────────────────────────────────────

export default function LoadingView({
  stages        = null,
  stage         = null,
  compact       = false,
  synthesisText = '',
  sources       = [],
  defaultOpen   = true,
}) {
  const theme     = useTheme()
  const isDark    = theme.palette.mode === 'dark'

  const displayStages = stages?.length
    ? stages
    : [{ id: stage ?? 'planning', label: 'Planning…', status: 'active' }]

  const allDone   = displayStages.length >= 2 && displayStages.every(s => s.status === 'done')
  const doneCount = displayStages.filter(s => s.status === 'done').length
  const [masterOpen, setMasterOpen] = useState(defaultOpen)

  const subduedColor   = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'
  const synthColor     = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)'

  return (
    <Box
      role="status" aria-live="polite" aria-atomic="false"
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        py: compact ? 1 : 2,
        px: compact ? 0 : 0,
        minHeight: compact ? 40 : 60,
        width: '100%',
      }}
    >
      {/* Screen-reader live region */}
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {displayStages.find(s => s.status === 'active')?.label ?? 'Complete'}
      </Box>

      {/* "Completed N steps" collapsible header */}
      {allDone && (
        <Box
          onClick={() => setMasterOpen(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            mb: masterOpen ? 1.5 : 0,
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { opacity: 0.75 },
            transition: 'opacity 0.15s',
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 13, color: subduedColor }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: subduedColor }}>
            Completed {doneCount} step{doneCount !== 1 ? 's' : ''}
          </Typography>
          {masterOpen
            ? <KeyboardArrowUpIcon   sx={{ fontSize: 13, color: subduedColor }} />
            : <KeyboardArrowDownIcon sx={{ fontSize: 13, color: subduedColor }} />
          }
        </Box>
      )}

      {/* Stage list */}
      <Collapse in={!allDone || masterOpen} timeout={220}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {displayStages.map((s, i) => (
            <StageRow
              key={`${s.id}-${i}`}
              stage={s}
              sources={sources}
              isLast={i === displayStages.length - 1}
              compact={compact}
              isDark={isDark}
            />
          ))}
        </Box>
      </Collapse>

      {/* Streaming synthesis preview */}
      {synthesisText && (
        <Box sx={{
          mt: 1.5,
          borderLeft: `1.5px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          pl: 1.5, ml: 0.25,
        }}>
          <Typography sx={{
            fontSize: 13, color: synthColor, lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {synthesisText.length > 400
              ? `…${synthesisText.slice(-400)}`
              : synthesisText
            }
          </Typography>
        </Box>
      )}
    </Box>
  )
}
