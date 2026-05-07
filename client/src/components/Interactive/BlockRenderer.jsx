import { useEffect, Suspense } from 'react'
import { Box, Stack, Skeleton, Typography, useTheme } from '@mui/material'
import { withProfiler } from '../../lib/sentry.js'
import MarkdownText from './MarkdownText'
import { resolveEntity, getBlockMeta } from './registry'
import { useSceneStore } from './useSceneStore'
import ErrorBoundary from '../error/ErrorBoundary'
import BlockWrapper from './BlockWrapper'
import { TYPOGRAPHY, RADIUS, BRAND } from '../../theme/tokens.js'

function FallbackCard({ entityType }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box sx={{
      p: 2,
      borderRadius: `${RADIUS.md}px`,
      border: `1px solid ${theme.palette.error.main}`,
      backgroundColor: isDark ? 'rgba(181,51,51,0.08)' : '#fff5f5',
    }}>
      <Typography sx={{ fontSize: TYPOGRAPHY.sizes.caption, color: 'error.main' }}>
        Widget &quot;{entityType}&quot; failed to render.
      </Typography>
    </Box>
  )
}

function BlockRenderer({ title, learningObjective, blocks = [], isLoading }) {
  const resetScene = useSceneStore(s => s.resetScene)
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  useEffect(() => {
    resetScene()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
          backgroundColor: isDark ? 'rgba(75,114,255,0.08)' : 'rgba(75,114,255,0.05)',
          borderLeft: `3px solid ${BRAND.accent}`,
        }}>
          <Typography sx={{
            fontSize: TYPOGRAPHY.sizes.caption,
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
            lineHeight: 1.5,
          }}>
            <Box component="span" sx={{ fontWeight: 600, color: BRAND.accent, mr: 0.75 }}>
              Goal:
            </Box>
            {learningObjective}
          </Typography>
        </Box>
      )}

      {blocks.map(block => {
        if (block.type === 'text') {
          return <MarkdownText key={block.id} content={block.content} />
        }

        const Component = resolveEntity(block.entity_type)
        const meta      = getBlockMeta(block.entity_type)
        const copyText  = meta.getCopyText ? meta.getCopyText(block.props ?? {}) : null
        const noExpand  = meta.noExpand ?? false
        const label     = (block.entity_type ?? '').replace(/_/g, ' ')

        return (
          <ErrorBoundary
            key={block.id}
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
      })}

      {isLoading && blocks.length > 0 && (
        <Skeleton
          variant="rectangular"
          sx={{ width: '100%', height: 80, borderRadius: `${RADIUS.md}px` }}
          animation="wave"
        />
      )}
    </Stack>
  )
}

export default withProfiler(BlockRenderer, 'BlockRenderer')
