import { useEffect, Suspense } from 'react'
import { Box, Stack, Skeleton, Typography } from '@mui/material'
import { withProfiler } from '../../lib/sentry.js'
import MarkdownText from './MarkdownText'
import { resolveEntity, getBlockMeta } from './registry'
import { TurnIdContext, useSceneStore } from './useSceneStore'
import ErrorBoundary from '../error/ErrorBoundary'
import BlockWrapper from './BlockWrapper'
import { TYPOGRAPHY, RADIUS } from '../../theme/tokens.js'
import { useIsDark } from '../../hooks/useIsDark'
import { neutralGhost, neutralSurface, neutralBorderFaint, neutralBorder } from '../../theme/styleUtils.js'

function FallbackCard({ entityType }) {
  const isDark = useIsDark()
  return (
    <Box sx={{
      p: 2,
      borderRadius: `${RADIUS.md}px`,
      border: `1px solid`,
      borderColor: 'error.main',
      backgroundColor: isDark ? 'rgba(181,51,51,0.08)' : '#fff5f5',
    }}>
      <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: 'error.main' }}>
        Widget &quot;{entityType}&quot; failed to render.
      </Typography>
    </Box>
  )
}

function BlockRenderer({ turnId, title, learningObjective, blocks = [], isLoading }) {
  const clearTurn = useSceneStore(s => s.clearTurn)
  const isDark    = useIsDark()

  useEffect(() => () => { if (turnId) clearTurn(turnId) }, [turnId, clearTurn])

  return (
    <TurnIdContext.Provider value={turnId ?? null}>
    <Stack spacing={2}>
      {title && (
        <Typography sx={{
          fontSize:   TYPOGRAPHY.sizes.bodyLg,
          fontWeight: TYPOGRAPHY.weights.semibold,
          lineHeight: TYPOGRAPHY.lineHeights.snug,
          color: 'text.primary',
        }}>
          {title}
        </Typography>
      )}

      {learningObjective && (
        <Box sx={{
          px: 2, py: 1.25,
          borderRadius: `${RADIUS.md}px`,
          backgroundColor: neutralGhost(isDark),
          borderLeft: `3px solid ${neutralBorder(isDark)}`,
        }}>
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
            lineHeight: 1.5,
          }}>
            <Box component="span" sx={{ fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)', mr: 0.75 }}>
              Goal:
            </Box>
            {learningObjective}
          </Typography>
        </Box>
      )}

      {!isLoading && blocks.length === 0 && !title && !learningObjective && (
        <Box sx={{
          py: 3, px: 2, borderRadius: `${RADIUS.lg}px`, textAlign: 'center',
          backgroundColor: neutralGhost(isDark),
          border: `1px solid ${neutralBorderFaint(isDark)}`,
        }}>
          <Typography sx={{ fontSize: TYPOGRAPHY.sizes.bodySm, color: 'text.disabled' }}>
            Content couldn't be loaded. Try asking again.
          </Typography>
        </Box>
      )}

      {blocks.map(block => {
        const inner = block.type === 'text' ? (
          <MarkdownText content={block.content} />
        ) : (() => {
          const Component = resolveEntity(block.entity_type)
          const meta      = getBlockMeta(block.entity_type)
          const copyText  = meta.getCopyText ? meta.getCopyText(block.props ?? {}) : null
          const noExpand  = meta.noExpand ?? false
          const label     = (block.entity_type ?? '').replace(/_/g, ' ')
          return (
            <ErrorBoundary
              level="component"
              fallback={<FallbackCard entityType={block.entity_type} />}
            >
              <BlockWrapper copyText={copyText || null} label={label} noExpand={noExpand}>
                <Suspense fallback={<Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />}>
                  <Component
                    entityId={block.id}
                    {...(block.props ?? {})}
                    html={block.html ?? null}
                  />
                </Suspense>
              </BlockWrapper>
            </ErrorBoundary>
          )
        })()

        return (
          <Box
            key={block.id}
            sx={{
              '@keyframes blockReveal': {
                from: { opacity: 0, transform: 'translateY(10px)' },
                to:   { opacity: 1, transform: 'translateY(0)' },
              },
              animation: 'blockReveal 0.35s ease-out both',
            }}
          >
            {inner}
          </Box>
        )
      })}

      {isLoading && blocks.length > 0 && (
        <Skeleton
          variant="rectangular"
          sx={{ width: '100%', height: 80, borderRadius: `${RADIUS.md}px` }}
          animation="wave"
        />
      )}
    </Stack>
    </TurnIdContext.Provider>
  )
}

export default withProfiler(BlockRenderer, 'BlockRenderer')
