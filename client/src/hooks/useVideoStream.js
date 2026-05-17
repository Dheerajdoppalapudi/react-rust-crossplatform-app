import { useRef, useCallback } from 'react'
import { api } from '../services/api'
import { applyStage, applyStageDone } from '../utils/sseUtils'

export function useVideoStream({ setTurns, toast }) {
  const videoAbortControllersRef = useRef(new Map())

  const setTurnVideoPhase = useCallback((tempId, sessionId, phase) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.tempId === tempId || (sessionId && t.id === sessionId)
          ? { ...t, videoPhase: phase }
          : t
      )
    )
  }, []) // setTurns is a stable React dispatcher — excluded from deps intentionally

  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId, onDone) => {
    const controller = new AbortController()
    videoAbortControllersRef.current.set(tempId, controller)

    const matchTurn = (t) => t.tempId === tempId || (sessionId && t.id === sessionId)

    try {
      await api.generateVideoStream(
        sessionId,
        (event) => {
          if (event.type === 'stage') {
            setTurns(prev => prev.map(t =>
              matchTurn(t) ? { ...t, stages: applyStage(t.stages ?? [], event) } : t
            ))
          } else if (event.type === 'stage_done') {
            setTurns(prev => prev.map(t =>
              matchTurn(t) ? { ...t, stages: applyStageDone(t.stages ?? [], event) } : t
            ))
          } else if (event.type === 'done') {
            setTurnVideoPhase(tempId, sessionId, event.video_path ? 'ready' : 'error')
          } else if (event.type === 'error') {
            setTurnVideoPhase(tempId, sessionId, 'error')
          }
        },
        controller.signal,
      )
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setTurnVideoPhase(tempId, sessionId, 'error')
      }
    } finally {
      videoAbortControllersRef.current.delete(tempId)
      onDone?.()
    }
  }, [setTurnVideoPhase])

  const handleRetryTurn = useCallback((turn) => {
    if (!turn.id) return
    setTurnVideoPhase(turn.tempId, turn.id, 'generating')
    runVideoGenerationForTurn(turn.tempId, turn.id)
  }, [setTurnVideoPhase, runVideoGenerationForTurn])

  const abortAll = useCallback(() => {
    for (const controller of videoAbortControllersRef.current.values()) {
      controller.abort()
    }
    videoAbortControllersRef.current.clear()
  }, [])

  return {
    videoAbortControllersRef,
    setTurnVideoPhase,
    runVideoGenerationForTurn,
    handleRetryTurn,
    abortAll,
  }
}
