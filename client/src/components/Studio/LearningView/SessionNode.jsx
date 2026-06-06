import { useState, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { Box, Typography, Tooltip, useTheme } from '@mui/material'

// Content-type icons
import FunctionsOutlinedIcon       from '@mui/icons-material/FunctionsOutlined'
import AccountTreeOutlinedIcon     from '@mui/icons-material/AccountTreeOutlined'
import TimelineOutlinedIcon        from '@mui/icons-material/TimelineOutlined'
import OndemandVideoOutlinedIcon   from '@mui/icons-material/OndemandVideoOutlined'
import ChatBubbleOutlineIcon       from '@mui/icons-material/ChatBubbleOutline'
import LightbulbOutlinedIcon       from '@mui/icons-material/LightbulbOutlined'
import CompareArrowsIcon           from '@mui/icons-material/CompareArrows'
import BrushOutlinedIcon           from '@mui/icons-material/BrushOutlined'
import PlayArrowRoundedIcon        from '@mui/icons-material/PlayArrowRounded'
import SubdirectoryArrowRightIcon  from '@mui/icons-material/SubdirectoryArrowRight'
import AutorenewIcon               from '@mui/icons-material/Autorenew'
import AddIcon                     from '@mui/icons-material/Add'

// Entity-preview icons
import BarChartOutlinedIcon        from '@mui/icons-material/BarChartOutlined'
import CodeOutlinedIcon            from '@mui/icons-material/CodeOutlined'
import QuizOutlinedIcon            from '@mui/icons-material/QuizOutlined'
import TableChartOutlinedIcon      from '@mui/icons-material/TableChartOutlined'
import MapOutlinedIcon             from '@mui/icons-material/MapOutlined'
import TerminalOutlinedIcon        from '@mui/icons-material/TerminalOutlined'
import StyleOutlinedIcon           from '@mui/icons-material/StyleOutlined'
import BubbleChartOutlinedIcon     from '@mui/icons-material/BubbleChartOutlined'
import ScienceOutlinedIcon         from '@mui/icons-material/ScienceOutlined'
import SlideshowOutlinedIcon       from '@mui/icons-material/SlideshowOutlined'

import { useMediaUrl }             from '../../../hooks/useMediaUrl'
import {
  NODE_W, INTERACTIVE_NODE_H, VIDEO_NODE_H, getNodeHeight,
} from './useFlowData'
import { BRAND, PALETTE, INTENT_COLORS } from '../../../theme/tokens.js'
import { isTextTurn, getFrameCount, formatIntentType } from '../studioUtils'
import { getActiveStageLabel }     from './utils'
import { pulse, shimmer, fadeIn }  from '../../../theme/animations'
import { relativeTime }            from '../../../utils/formatTime'
import { neutralBorderDefault } from '../../../theme/styleUtils.js'

// ─── Thumbnail height inside video cards ──────────────────────────────────────
const THUMB_H = 138

// ─── AskNode panel height (unchanged from original) ───────────────────────────
const ASK_H = 138

// ─── Content-type config ──────────────────────────────────────────────────────

const SPIN = {
  animation: 'nodeSpinner 1s linear infinite',
  '@keyframes nodeSpinner': {
    from: { transform: 'rotate(0deg)' },
    to:   { transform: 'rotate(360deg)' },
  },
}

function getTypeConfig(turn, isDark) {
  // Video turns
  if (turn.render_path && turn.render_path !== 'interactive') {
    return {
      label:       'Video',
      Icon:        OndemandVideoOutlinedIcon,
      badgeBg:     isDark ? 'rgba(255,255,255,0.07)' : PALETTE.warmSand,
      badgeColor:  isDark ? PALETTE.darkWarm          : PALETTE.charcoalWarm,
      cardBorder:  isDark ? PALETTE.borderDark        : PALETTE.border,
    }
  }

  // Intent-specific configs
  const map = {
    math: {
      label: 'Math', Icon: FunctionsOutlinedIcon,
      badgeBg:    isDark ? 'rgba(59,130,246,0.14)'  : INTENT_COLORS.math.bg,
      badgeColor: isDark ? '#93c5fd'                : INTENT_COLORS.math.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    concept_analogy: {
      label: 'Concept', Icon: LightbulbOutlinedIcon,
      badgeBg:    isDark ? 'rgba(180,83,9,0.16)'    : INTENT_COLORS.concept.bg,
      badgeColor: isDark ? '#fcd34d'                : INTENT_COLORS.concept.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    comparison: {
      label: 'Compare', Icon: CompareArrowsIcon,
      badgeBg:    isDark ? 'rgba(180,83,9,0.16)'    : INTENT_COLORS.concept.bg,
      badgeColor: isDark ? '#fcd34d'                : INTENT_COLORS.concept.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    process: {
      label: 'Process', Icon: AccountTreeOutlinedIcon,
      badgeBg:    isDark ? 'rgba(190,24,93,0.14)'   : INTENT_COLORS.diagram.bg,
      badgeColor: isDark ? '#f9a8d4'                : INTENT_COLORS.diagram.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    architecture: {
      label: 'Diagram', Icon: AccountTreeOutlinedIcon,
      badgeBg:    isDark ? 'rgba(190,24,93,0.14)'   : INTENT_COLORS.diagram.bg,
      badgeColor: isDark ? '#f9a8d4'                : INTENT_COLORS.diagram.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    timeline: {
      label: 'Timeline', Icon: TimelineOutlinedIcon,
      badgeBg:    isDark ? 'rgba(190,24,93,0.14)'   : INTENT_COLORS.diagram.bg,
      badgeColor: isDark ? '#f9a8d4'                : INTENT_COLORS.diagram.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
    illustration: {
      label: 'Visual', Icon: BrushOutlinedIcon,
      badgeBg:    isDark ? 'rgba(190,24,93,0.14)'   : INTENT_COLORS.diagram.bg,
      badgeColor: isDark ? '#f9a8d4'                : INTENT_COLORS.diagram.text,
      cardBorder: isDark ? PALETTE.borderDark       : PALETTE.border,
    },
  }

  if (map[turn.intent_type]) return map[turn.intent_type]

  // General fallback — brand-teal border
  return {
    label:      'General',
    Icon:       ChatBubbleOutlineIcon,
    badgeBg:    isDark ? 'rgba(47,212,181,0.13)' : BRAND.soft,
    badgeColor: isDark ? BRAND.glow              : BRAND.primary,
    cardBorder: isDark ? BRAND.glow              : BRAND.primary,
  }
}

// ─── Entity-icon map ──────────────────────────────────────────────────────────

const ENTITY_ICON_MAP = {
  math_formula:     FunctionsOutlinedIcon,
  function_plotter: FunctionsOutlinedIcon,
  mermaid_viewer:   AccountTreeOutlinedIcon,
  graph_canvas:     BubbleChartOutlinedIcon,
  ds_viewer:        AccountTreeOutlinedIcon,
  code_walkthrough: CodeOutlinedIcon,
  step_controls:    CodeOutlinedIcon,
  terminal_output:  TerminalOutlinedIcon,
  diff_viewer:      CodeOutlinedIcon,
  freeform_html:    CodeOutlinedIcon,
  chart:            BarChartOutlinedIcon,
  plotly:           BarChartOutlinedIcon,
  quiz_block:       QuizOutlinedIcon,
  flashcard_deck:   StyleOutlinedIcon,
  table_viewer:     TableChartOutlinedIcon,
  timeline:         TimelineOutlinedIcon,
  map_viewer:       MapOutlinedIcon,
  molecule_viewer:  ScienceOutlinedIcon,
  slide_deck:       SlideshowOutlinedIcon,
  p5_sketch:        BrushOutlinedIcon,
}

function getUniqueEntityIcons(blocks = []) {
  const seen  = new Set()
  const icons = []
  for (const b of blocks) {
    if (b.type === 'entity' && b.entity_type && !seen.has(b.entity_type)) {
      seen.add(b.entity_type)
      const Icon = ENTITY_ICON_MAP[b.entity_type]
      if (Icon) icons.push({ type: b.entity_type, Icon })
    }
  }
  return icons
}

// ─── Description derivation ───────────────────────────────────────────────────

function getDescription(turn) {
  if (turn.learningObjective) return turn.learningObjective
  if (turn.framesData?.captions?.[0]) return turn.framesData.captions[0]
  if (turn.render_path === 'interactive' && turn.blocks?.length) {
    const tb = turn.blocks.find((b) => b.type === 'text' && b.content)
    if (tb) {
      return tb.content
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim()
        .slice(0, 130)
    }
  }
  return ''
}

// ─── Shared sub-elements ──────────────────────────────────────────────────────

function NodeHeader({ indexLabel, typeConfig, timestamp, isDark, theme, loading = false }) {
  return (
    <Box sx={{
      px: 1.5, pt: 1.25, pb: 0.875,
      display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0,
    }}>
      {/* Sequential index */}
      <Typography sx={{
        fontSize: 11, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
        color: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.26)',
      }}>
        {indexLabel}
      </Typography>

      {/* Vertical pipe separator */}
      <Box sx={{
        width: '1px', height: 10, flexShrink: 0,
        bgcolor: neutralBorderDefault(isDark),
      }} />

      {/* Content-type badge */}
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        px: 0.8, py: 0.3, borderRadius: '20px', flexShrink: 0,
        bgcolor: typeConfig.badgeBg,
      }}>
        <typeConfig.Icon sx={{ fontSize: 9.5, color: typeConfig.badgeColor }} />
        <Typography sx={{
          fontSize: 9, fontWeight: 700, lineHeight: 1,
          color: typeConfig.badgeColor,
          textTransform: 'uppercase', letterSpacing: '0.055em',
        }}>
          {typeConfig.label}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />

      {/* Timestamp or live indicator */}
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45, flexShrink: 0 }}>
          <Box sx={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            bgcolor: isDark ? BRAND.glow : BRAND.primary,
            animation: `${pulse} 1.4s ease-in-out infinite`,
          }} />
          <Typography sx={{ fontSize: 10, fontWeight: 500, color: isDark ? BRAND.glow : BRAND.primary }}>
            now
          </Typography>
        </Box>
      ) : timestamp ? (
        <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled, flexShrink: 0 }}>
          {timestamp}
        </Typography>
      ) : null}
    </Box>
  )
}

function NodeDivider({ isDark }) {
  return (
    <Box sx={{
      mx: 1.5, height: '1px', flexShrink: 0,
      bgcolor: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)',
    }} />
  )
}

function NodeFooter({ left, right, isDark }) {
  return (
    <Box sx={{
      px: 1.5, py: 0.875, flexShrink: 0,
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor:   isDark ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.018)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {left}
      {right}
    </Box>
  )
}

function AskPill({ onClick, nodeHovered, isOpen, isDark }) {
  return (
    <Tooltip title="Ask a follow-up" placement="bottom" arrow>
      <Box
        onClick={onClick}
        sx={{
          position: 'absolute', bottom: -13, left: '50%',
          transform: 'translateX(-50%)',
          height: 22, px: 1.25, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 0.4,
          borderRadius: '11px', cursor: 'pointer',
          opacity:       nodeHovered && !isOpen ? 1 : 0,
          pointerEvents: nodeHovered && !isOpen ? 'all' : 'none',
          bgcolor:    isDark ? PALETTE.darkSubsurface : '#fff',
          border:     `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
          boxShadow:  '0 2px 8px rgba(0,0,0,0.18)',
          transition: 'opacity 0.18s',
        }}
      >
        <AddIcon sx={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)' }} />
        <Typography sx={{
          fontSize: 9.5, fontWeight: 600, lineHeight: 1,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)',
        }}>
          Ask
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ─── Card shadow helpers ───────────────────────────────────────────────────────

const restShadow = (isDark) => isDark
  ? '0 1px 2px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.22), 0 14px 32px rgba(0,0,0,0.18)'
  : '0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 14px 32px rgba(0,0,0,0.05)'

const hoverShadow = (isDark) => isDark
  ? '0 2px 4px rgba(0,0,0,0.36), 0 6px 18px rgba(0,0,0,0.30), 0 20px 48px rgba(0,0,0,0.24)'
  : '0 2px 4px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.12), 0 20px 48px rgba(0,0,0,0.07)'

// ─── LOADING NODE ─────────────────────────────────────────────────────────────

function LoadingNode({ turn, isDark, theme, indexLabel }) {
  const typeConfig  = turn.intent_type
    ? getTypeConfig({ ...turn, render_path: null }, isDark)
    : {
        label: 'Processing', Icon: ChatBubbleOutlineIcon,
        badgeBg:    isDark ? 'rgba(255,255,255,0.07)' : PALETTE.warmSand,
        badgeColor: isDark ? PALETTE.darkWarm          : PALETTE.charcoalWarm,
        cardBorder: isDark ? PALETTE.borderDark        : PALETTE.border,
      }

  const stageLabel = getActiveStageLabel(turn)

  return (
    <Box sx={{
      width: NODE_W, height: INTERACTIVE_NODE_H,
      borderRadius: '12px',
      border: `1px solid ${isDark ? PALETTE.borderDark : PALETTE.border}`,
      bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: restShadow(isDark),
      animation: `${fadeIn} 0.3s ease-out`,
    }}>
      <NodeHeader
        indexLabel={indexLabel}
        typeConfig={typeConfig}
        isDark={isDark}
        theme={theme}
        loading
      />
      <NodeDivider isDark={isDark} />

      {/* Title */}
      <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
        <Typography sx={{
          fontSize: 13.5, fontWeight: 700, lineHeight: 1.35,
          color: theme.palette.text.primary,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {turn.prompt || 'Untitled'}
        </Typography>
      </Box>

      {/* Skeleton bars */}
      <Box sx={{ px: 1.5, pt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {[{ w: '78%', delay: '0s' }, { w: '55%', delay: '0.25s' }].map(({ w, delay }, i) => (
          <Box key={i} sx={{
            height: 7, width: w, borderRadius: '4px', overflow: 'hidden', position: 'relative',
            bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          }}>
            <Box sx={{
              position: 'absolute', inset: 0,
              background: isDark
                ? 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.09) 50%, transparent 80%)'
                : 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.75) 50%, transparent 80%)',
              animation: `${shimmer} 1.6s ease-in-out ${delay} infinite`,
            }} />
          </Box>
        ))}
      </Box>

      {/* Stage indicator */}
      <Box sx={{ px: 1.5, pt: 1, display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <AutorenewIcon sx={{
          fontSize: 11.5, color: isDark ? BRAND.glow : BRAND.primary, flexShrink: 0,
          ...SPIN,
        }} />
        <Typography sx={{ fontSize: 10.5, fontWeight: 500, color: isDark ? BRAND.glow : BRAND.primary }}>
          {stageLabel}
        </Typography>
      </Box>
    </Box>
  )
}

// ─── INTERACTIVE NODE (render_path === 'interactive') ─────────────────────────

function InteractiveNode({ turn, data, isDark, theme, indexLabel, nodeHovered, isOpen, openPanel, isSelected }) {
  const typeConfig  = getTypeConfig(turn, isDark)
  const description = getDescription(turn)
  const entityIcons = getUniqueEntityIcons(turn.blocks ?? [])
  const selColor    = isDark ? BRAND.glow : BRAND.primary

  const timestamp = turn.created_at ? relativeTime(turn.created_at) : null

  const footerLeft = data.followUpCount > 0 ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
      <SubdirectoryArrowRightIcon sx={{ fontSize: 10, color: theme.palette.text.disabled }} />
      <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled }}>
        {data.followUpCount} follow-{data.followUpCount === 1 ? 'up' : 'ups'}
      </Typography>
    </Box>
  ) : <Box />

  const footerRight = data.isLatest ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography sx={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
        color: isDark ? BRAND.glow : BRAND.primary,
      }}>
        ACTIVE
      </Typography>
      <Box sx={{
        width: 5, height: 5, borderRadius: '50%',
        bgcolor: isDark ? BRAND.glow : BRAND.primary,
        animation: `${pulse} 1.4s ease-in-out infinite`,
      }} />
    </Box>
  ) : null

  return (
    <Box sx={{ position: 'relative' }}>
      <AskPill onClick={openPanel} nodeHovered={nodeHovered} isOpen={isOpen} isDark={isDark} />

      <Box sx={{
        width: NODE_W, height: INTERACTIVE_NODE_H,
        borderRadius: '12px',
        // Selected (opened) node: a single brand border + soft glow — no second ring.
        border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? selColor : typeConfig.cardBorder}`,
        bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: isSelected
          ? `${restShadow(isDark)}, 0 0 18px ${isDark ? 'rgba(47,212,181,0.28)' : 'rgba(14,124,102,0.18)'}`
          : restShadow(isDark),
        transition: 'border-color 0.2s, box-shadow 0.18s, transform 0.15s',
        '&:hover': {
          transform:  'translateY(-1px)',
          boxShadow:  isSelected
            ? `${hoverShadow(isDark)}, 0 0 18px ${isDark ? 'rgba(47,212,181,0.28)' : 'rgba(14,124,102,0.18)'}`
            : hoverShadow(isDark),
        },
      }}>
        <NodeHeader
          indexLabel={indexLabel}
          typeConfig={typeConfig}
          timestamp={timestamp}
          isDark={isDark}
          theme={theme}
        />
        <NodeDivider isDark={isDark} />

        {/* Title + description */}
        <Box sx={{ px: 1.5, pt: 1.25, flex: 1, overflow: 'hidden' }}>
          <Typography sx={{
            fontSize: 13.5, fontWeight: 700, lineHeight: 1.35,
            color: theme.palette.text.primary,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            mb: description ? 0.625 : 0,
          }}>
            {turn.prompt || 'Untitled'}
          </Typography>

          {description && (
            <Typography sx={{
              fontSize: 11, lineHeight: 1.5, fontWeight: 400,
              color: theme.palette.text.secondary,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {description}
            </Typography>
          )}

          {/* Entity icon chips */}
          {entityIcons.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.875 }}>
              {entityIcons.slice(0, 5).map((ei) => {
                const EIcon = ei.Icon
                return (
                  <Box key={ei.type} sx={{
                    width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border:  `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`,
                  }}>
                    <EIcon sx={{ fontSize: 10, color: theme.palette.text.secondary }} />
                  </Box>
                )
              })}
              {entityIcons.length > 5 && (
                <Typography sx={{ fontSize: 9.5, color: theme.palette.text.disabled }}>
                  +{entityIcons.length - 5}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        <NodeFooter left={footerLeft} right={footerRight} isDark={isDark} />
      </Box>
    </Box>
  )
}

// ─── VIDEO NODE ───────────────────────────────────────────────────────────────

function VideoNode({ turn, data, isDark, theme, indexLabel, nodeHovered, isOpen, openPanel, getFrameUrl, imgError, setImgError, thumbHover, setThumbHover, duration, isSelected }) {
  const typeConfig  = getTypeConfig(turn, isDark)
  const description = getDescription(turn)
  const frameCount  = getFrameCount(turn)
  const isReady     = turn.videoPhase === 'ready'
  const selColor    = isDark ? BRAND.glow : BRAND.primary

  const frameUrl = getFrameUrl(0)

  const timestamp = duration
    ? duration
    : turn.created_at ? relativeTime(turn.created_at) : null

  const footerLeft = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
      <SubdirectoryArrowRightIcon sx={{ fontSize: 10, color: theme.palette.text.disabled }} />
      <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled }}>
        {turn.intent_type ? formatIntentType(turn.intent_type) : 'Video'}
        {frameCount > 0 ? ` · ${frameCount} slides` : ''}
      </Typography>
    </Box>
  )

  const footerRight = data.followUpCount > 0 ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
      <SubdirectoryArrowRightIcon sx={{ fontSize: 10, color: theme.palette.text.disabled }} />
      <Typography sx={{ fontSize: 10, color: theme.palette.text.disabled }}>
        {data.followUpCount}
      </Typography>
    </Box>
  ) : null

  return (
    <Box sx={{ position: 'relative' }}>
      <AskPill onClick={openPanel} nodeHovered={nodeHovered} isOpen={isOpen} isDark={isDark} />

      <Box sx={{
        width: NODE_W, height: VIDEO_NODE_H,
        borderRadius: '12px',
        // Selected (opened) node: a single brand border + soft glow — no second ring.
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? selColor : (isDark ? PALETTE.borderDark : PALETTE.border)}`,
        bgcolor: isDark ? PALETTE.darkSurface : PALETTE.ivory,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: isSelected
          ? `${restShadow(isDark)}, 0 0 18px ${isDark ? 'rgba(47,212,181,0.28)' : 'rgba(14,124,102,0.18)'}`
          : restShadow(isDark),
        transition: 'border-color 0.2s, box-shadow 0.18s, transform 0.15s',
        '&:hover': {
          borderColor: isSelected ? selColor : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'),
          transform:   'translateY(-1px)',
          boxShadow:   isSelected
            ? `${hoverShadow(isDark)}, 0 0 18px ${isDark ? 'rgba(47,212,181,0.28)' : 'rgba(14,124,102,0.18)'}`
            : hoverShadow(isDark),
        },
      }}>
        <NodeHeader
          indexLabel={indexLabel}
          typeConfig={typeConfig}
          timestamp={timestamp}
          isDark={isDark}
          theme={theme}
        />

        {/* Thumbnail */}
        <Box
          onMouseEnter={() => setThumbHover(true)}
          onMouseLeave={() => setThumbHover(false)}
          sx={{
            width: '100%', height: THUMB_H, flexShrink: 0,
            position: 'relative', overflow: 'hidden',
            bgcolor: isDark ? PALETTE.nearBlack : PALETTE.warmSand,
            borderTop:    `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'}`,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          {turn.id && !imgError && frameUrl ? (
            <img
              src={frameUrl} alt="" onError={() => setImgError(true)} draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                transition: 'transform 0.3s ease',
                transform: thumbHover ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          ) : (
            <Box sx={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <OndemandVideoOutlinedIcon sx={{ fontSize: 28, opacity: 0.14, color: theme.palette.text.secondary }} />
            </Box>
          )}

          {/* Play overlay */}
          {thumbHover && turn.id && !imgError && frameUrl && (
            <Box sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.30)',
            }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.9)', ml: '2px' }} />
              </Box>
            </Box>
          )}

          {/* Status dot — top-right, no box/background */}
          <Box sx={{ position: 'absolute', top: 7, right: 8, display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {isReady ? (
              <>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4ade80' }} />
                <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>READY</Typography>
              </>
            ) : turn.videoPhase === 'generating' ? (
              <>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#fb923c', animation: `${pulse} 1.2s ease-in-out infinite` }} />
                <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>GEN</Typography>
              </>
            ) : null}
          </Box>
        </Box>

        {/* Filmstrip */}
        {frameCount > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1.25, py: 0.75, flexShrink: 0, overflowX: 'hidden',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {Array.from({ length: Math.min(frameCount, 9) }).map((_, i) => {
              const fUrl = getFrameUrl(i)
              return (
                <Box key={i} sx={{
                  width: 24, height: 17, flexShrink: 0, borderRadius: '3px', overflow: 'hidden',
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
                  border:  `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
                }}>
                  {fUrl && (
                    <img src={fUrl} alt="" draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                </Box>
              )
            })}
            {frameCount > 9 && (
              <Typography sx={{ fontSize: 9, color: theme.palette.text.disabled, flexShrink: 0 }}>
                +{frameCount - 9}
              </Typography>
            )}
          </Box>
        )}

        {/* Title + description */}
        <Box sx={{ px: 1.5, pt: 1, flex: 1, overflow: 'hidden' }}>
          <Typography sx={{
            fontSize: 13, fontWeight: 700, lineHeight: 1.35,
            color: theme.palette.text.primary,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            mb: description ? 0.5 : 0,
          }}>
            {turn.prompt || 'Untitled'}
          </Typography>

          {description && (
            <Typography sx={{
              fontSize: 11, lineHeight: 1.5, fontWeight: 400,
              color: theme.palette.text.secondary,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {description}
            </Typography>
          )}
        </Box>

        <NodeFooter left={footerLeft} right={footerRight} isDark={isDark} />
      </Box>
    </Box>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SessionNode({ data }) {
  const { turn, isSelected } = data
  const theme    = useTheme()
  const isDark   = theme.palette.mode === 'dark'
  const { setNodes, setEdges, getNode } = useReactFlow()

  const [nodeHovered, setNodeHovered] = useState(false)
  const [thumbHover,  setThumbHover]  = useState(false)
  const [isOpen,      setIsOpen]      = useState(false)
  const [imgError,    setImgError]    = useState(false)
  const [duration,    setDuration]    = useState(null)

  const isText   = isTextTurn(turn)
  const isReady  = !isText && turn.videoPhase === 'ready'
  const nodeH    = getNodeHeight(turn)

  const { videoUrl, getFrameUrl } = useMediaUrl(turn.id)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setImgError(false) }, [turn.id])

  // Read video duration for the header timestamp
  useEffect(() => {
    if (!turn.id || !isReady || !videoUrl) return
    const v = document.createElement('video')
    v.src = videoUrl
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const s = Math.round(v.duration)
      setDuration(s >= 60
        ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
        : `0:${String(s).padStart(2, '0')}`)
    }
    return () => { v.onloadedmetadata = null; v.src = '' }
  }, [turn.id, isReady, videoUrl])

  // ── Ghost AskNode management ─────────────────────────────────────────────
  const ghostId = `ask_ghost_${turn.id}`
  const edgeId  = `ask_edge_${turn.id}`

  const removeGhost = () => {
    setNodes((ns) =>
      ns.filter((n) => n.id !== ghostId).map((n) => n.id === turn.id ? { ...n, zIndex: 0 } : n)
    )
    setEdges((es) => es.filter((e) => e.id !== edgeId))
    setIsOpen(false)
  }

  const openPanel = (e) => {
    e.stopPropagation()
    const self = getNode(turn.id)
    if (!self) return

    setNodes((ns) => [
      ...ns.map((n) => n.id === turn.id ? { ...n, zIndex: 999 } : n),
      {
        id:   ghostId,
        type: 'askNode',
        position: {
          x: self.position.x + NODE_W + 80,
          y: self.position.y + (nodeH - ASK_H) / 2,
        },
        data: {
          onSubmit: ({ question, model, videoEnabled }) => {
            removeGhost()
            data.onAsk?.({ question, sessionId: turn.id, model, videoEnabled })
          },
          onCancel:            removeGhost,
          defaultModel:        data.defaultModel,
          defaultVideoEnabled: data.defaultVideoEnabled,
          defaultNotesEnabled: data.defaultNotesEnabled,
        },
        draggable: true, selectable: false,
      },
    ])

    const edgeColor = isDark ? 'rgba(180,180,180,0.45)' : 'rgba(80,80,80,0.35)'
    setEdges((es) => [...es, {
      id: edgeId, source: turn.id, sourceHandle: 'ask-right', target: ghostId,
      type: 'default',
      style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5 4' },
      markerEnd: { type: 'arrowclosed', width: 20, height: 20, color: edgeColor },
    }])

    setIsOpen(true)
  }

  // ── Sequential index label ───────────────────────────────────────────────
  const indexLabel = String((turn.turn_index ?? 0) + 1).padStart(2, '0')

  // ── Handles (shared across all node types) ───────────────────────────────
  const handles = (
    <>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" id="ask-right" position={Position.Right}  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  )

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (turn.isLoading) {
    return (
      <>
        <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        <LoadingNode turn={turn} isDark={isDark} theme={theme} indexLabel={indexLabel} />
      </>
    )
  }

  // Selection is shown by a single brand border + glow inside the card itself
  // (see InteractiveNode/VideoNode) — no outer offset ring, so no double border.

  // ── INTERACTIVE ──────────────────────────────────────────────────────────
  if (isText) {
    return (
      <Box
        onMouseEnter={() => setNodeHovered(true)}
        onMouseLeave={() => { if (!isOpen) setNodeHovered(false) }}
      >
        {handles}
        <InteractiveNode
          turn={turn}
          data={data}
          isDark={isDark}
          theme={theme}
          indexLabel={indexLabel}
          nodeHovered={nodeHovered}
          isOpen={isOpen}
          openPanel={openPanel}
          isSelected={isSelected}
        />
      </Box>
    )
  }

  // ── VIDEO ────────────────────────────────────────────────────────────────
  return (
    <Box
      onMouseEnter={() => setNodeHovered(true)}
      onMouseLeave={() => { if (!isOpen) setNodeHovered(false) }}
    >
      {handles}
      <VideoNode
        turn={turn}
        data={data}
        isDark={isDark}
        theme={theme}
        indexLabel={indexLabel}
        nodeHovered={nodeHovered}
        isOpen={isOpen}
        openPanel={openPanel}
        getFrameUrl={getFrameUrl}
        imgError={imgError}
        setImgError={setImgError}
        thumbHover={thumbHover}
        setThumbHover={setThumbHover}
        duration={duration}
        isSelected={isSelected}
      />
    </Box>
  )
}
