import { useEffect } from 'react'
import { Stack, Box, Typography } from '@mui/material'
import { resolveEntity } from './registry'
import { useSceneStore } from './useSceneStore'
import ErrorBoundary from '../error/ErrorBoundary'

function FallbackCard({ type }) {
  return (
    <Box sx={{
      p: 2, borderRadius: 2, border: '1px solid', borderColor: 'error.main',
      backgroundColor: 'error.50',
    }}>
      <Typography variant="caption" color="error">
        Widget "{type}" failed to render.
      </Typography>
    </Box>
  )
}

/**
 * Renders an ordered list of interactive entities.
 * Zustand (useSceneStore) owns all step state — no local state here.
 * resetScene() clears stale steps from prior turns on mount.
 */
export default function SceneRenderer({ entities = [] }) {
  const resetScene = useSceneStore(s => s.resetScene)

  useEffect(() => {
    resetScene()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entities.length) return null

  return (
    <Stack spacing={1.5}>
      {entities.map(entity => {
        const Component = resolveEntity(entity.type)
        return (
          <ErrorBoundary key={entity.id} level="component" fallback={<FallbackCard type={entity.type} />}>
            <Component
              entityId={entity.id}
              {...entity.props}
              html={entity.html ?? null}
            />
          </ErrorBoundary>
        )
      })}
    </Stack>
  )
}
