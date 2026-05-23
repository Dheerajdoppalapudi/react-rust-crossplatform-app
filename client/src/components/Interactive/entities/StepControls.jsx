import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@mui/material'
import { useSceneStore, useTurnId } from '../useSceneStore'
import PlaybackBar from './PlaybackBar'

export default function StepControls({
  entityId,
  steps          = [],
  targetEntityId,
  autoPlay       = false,
  interval       = 3000,
  loop           = false,
  showPlayButton = true,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const turnId         = useTurnId()
  const resolvedTarget = targetEntityId || entityId
  const step           = useSceneStore(s => s.getStep(turnId, resolvedTarget))
  const _setStep       = useSceneStore(s => s.setStep)
  const setStep        = useCallback((entityId, v) => _setStep(turnId, entityId, v), [turnId, _setStep])

  const total = steps.length
  const label = steps[step] ?? `Step ${step + 1}`

  const [isPlaying,    setIsPlaying]    = useState(autoPlay)
  const [autoInterval, setAutoInterval] = useState(interval)

  const advance = useCallback(() => {
    setStep(resolvedTarget, (prev) => {
      if (prev >= total - 1) {
        if (loop) return 0
        setIsPlaying(false)
        return prev
      }
      return prev + 1
    })
  }, [resolvedTarget, setStep, total, loop])

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(advance, autoInterval)
    return () => clearInterval(id)
  }, [isPlaying, advance, autoInterval])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault()
      advance()
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setIsPlaying(false)
      setStep(resolvedTarget, s => Math.max(0, s - 1))
    }
  }, [advance, resolvedTarget, setStep])

  const prev    = () => { setIsPlaying(false); setStep(resolvedTarget, Math.max(0, step - 1)) }
  const next    = () => { setIsPlaying(false); setStep(resolvedTarget, Math.min(total - 1, step + 1)) }
  const restart = () => { setStep(resolvedTarget, 0); setIsPlaying(true) }

  return (
    <PlaybackBar
      step={step}
      total={total}
      label={label}
      isPlaying={isPlaying}
      autoInterval={autoInterval}
      loop={loop}
      showPlayButton={showPlayButton}
      isDark={isDark}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPlayPause={() => setIsPlaying(p => !p)}
      onPrev={prev}
      onNext={next}
      onRestart={restart}
      onSpeedChange={setAutoInterval}
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 2,
        p: 1.5,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    />
  )
}
