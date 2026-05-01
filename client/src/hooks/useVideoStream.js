import { useRef, useCallback } from 'react'
import { api } from '../services/api'

/**
 * Manages all video generation SSE streams for the Studio.
 *
 * Owns the per-turn AbortController map so that individual video streams can be
 * cancelled independently (e.g. when the user switches conversations) without
 * affecting other in-progress streams.
 *
 * @param {object}   params
 * @param {Function} params.setTurns - React state setter for the turns array.
 * @param {object}   params.toast    - Toast context (from useToast).
 */
export function useVideoStream({ setTurns, toast }) {
  // Map of tempId → AbortController for every active video stream.
  const videoAbortControllersRef = useRef(new Map())

  /**
   * Updates videoPhase on the turn identified by tempId OR sessionId.
   * Both identifiers are checked so the phase can be set before or after the
   * turn transitions from its temporary id to its real session id.
   */
  const setTurnVideoPhase = useCallback((tempId, sessionId, phase) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.tempId === tempId || (sessionId && t.id === sessionId)
          ? { ...t, videoPhase: phase }
          : t
      )
    )
  }, []) // setTurns is a stable React dispatcher — excluded from deps intentionally

  /**
   * Starts video generation for a turn. Registers an AbortController so the
   * stream can be cancelled individually. Calls onDone when the stream closes
   * (whether success or error) so the caller can clear bootstrap state, etc.
   */
  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId, onDone) => {
    const controller = new AbortController()
    videoAbortControllersRef.current.set(tempId, controller)

    try {
      await api.generateVideoStream(
        sessionId,
        (event) => {
          if (event.type === 'done') {
            setTurnVideoPhase(tempId, sessionId, event.video_path ? 'ready' : 'error')
          } else if (event.type === 'error') {
            setTurnVideoPhase(tempId, sessionId, 'error')
          }
        },
        controller.signal,
      )
    } catch (err) {
      // generateVideoStream resolves (not rejects) for AbortError — this guard
      // is a safety net for unexpected rejections.
      if (err?.name !== 'AbortError') {
        setTurnVideoPhase(tempId, sessionId, 'error')
      }
    } finally {
      videoAbortControllersRef.current.delete(tempId)
      onDone?.()
    }
  }, [setTurnVideoPhase])

  /**
   * Retries video generation for a turn that already has a session id (i.e.
   * the frames were generated but video assembly failed).
   */
  const handleRetryTurn = useCallback((turn) => {
    if (!turn.id) return
    setTurnVideoPhase(turn.tempId, turn.id, 'generating')
    runVideoGenerationForTurn(turn.tempId, turn.id)
  }, [setTurnVideoPhase, runVideoGenerationForTurn])

  /**
   * Cancels every active video stream. Used when switching conversations or
   * unmounting the Studio component.
   */
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
