import { useEffect } from 'react'
import { Box, Stack, Skeleton, Typography, useTheme } from '@mui/material'
import MarkdownText from './MarkdownText'
import { resolveEntity } from './registry'
import { useSceneStore } from './useSceneStore'
import ErrorBoundary from '../error/ErrorBoundary'
import { TYPOGRAPHY, RADIUS } from '../../theme/tokens.js'

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

export default function BlockRenderer({ title, blocks = [], isLoading }) {
  const resetScene = useSceneStore(s => s.resetScene)

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

      {blocks.map(block => {
        if (block.type === 'text') {
          return <MarkdownText key={block.id} content={block.content} />
        }

        const Component = resolveEntity(block.entity_type)
        return (
          <ErrorBoundary
            key={block.id}
            level="component"
            fallback={<FallbackCard entityType={block.entity_type} />}
          >
            <Component
              entityId={block.id}
              {...(block.props ?? {})}
              html={block.html ?? null}
            />
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
