import { useState, useRef, useCallback } from 'react'
import { api } from '../services/api'
import { normalizeFramesData, migrateOldSceneIR } from '../components/Studio/studioUtils'

/**
 * Manages conversation loading, bootstrap animation state, and the
 * per-conversation load abort signal.
 *
 * Bootstrap state covers the first-turn loading experience: the full-screen
 * overlay that shows planning → generating → rendering → frames → video stages.
 * All fields are kept in one object so a single setState call atomically
 * transitions the overlay — no partial renders between setter calls.
 *
 * bootstrap shape: { stage: string, prompt: string, frames: object|null }
 * bootstrap === null means the overlay is not visible.
 *
 * @param {object}   params
 * @param {Function} params.setTurns               - React state setter for turns.
 * @param {Function} params.runVideoGenerationForTurn - From useVideoStream.
 * @param {Function} params.abortAllVideoStreams    - From useVideoStream.
 * @param {Function} params.scrollToTop             - Scrolls content area to top.
 * @param {object}   params.toast                   - Toast context (from useToast).
 */
export function useConversation({
  setTurns,
  runVideoGenerationForTurn,
  abortAllVideoStreams,
  scrollToTop,
  toast,
}) {
  // null = overlay hidden; object = overlay visible with current stage/prompt/frames.
  const [bootstrap, setBootstrap] = useState(null)

  // Tracks which conversation is currently loaded so the switch effect can
  // avoid redundant loads (e.g. when unrelated state causes a re-render).
  const loadedConvIdRef = useRef(null)

  // AbortController for the active getConversation + getFramesMeta requests.
  // Replaced on every new load so old loads are cleanly cancelled.
  const loadAbortRef = useRef(null)

  /**
   * Loads a conversation by id: fetches the session list, sets turns, then
   * concurrently fetches per-turn frames metadata, and resumes any video
   * streams that are still in a 'generating' state.
   *
   * Safe to call multiple times — each call cancels the previous in-flight load
   * and aborts all active video streams before starting fresh.
   */
  const loadConversationById = useCallback(async (convId) => {
    setTurns([])
    scrollToTop()

    // Cancel any prior load in flight.
    loadAbortRef.current?.abort()
    const loadController = new AbortController()
    loadAbortRef.current = loadController
    const { signal: loadSignal } = loadController

    // Cancel all video streams — they belong to the old conversation.
    abortAllVideoStreams()

    try {
      const data = await api.getConversation(convId, loadSignal)
      if (loadSignal.aborted) return
      if (!data) {
        toast.error('Could not load this conversation. It may have been deleted.')
        return
      }

      const loadedTurns = data.turns.map((t) => ({
        tempId:           t.id,
        id:               t.id,
        prompt:           t.prompt,
        intent_type:      t.intent_type,
        render_path:      t.render_path,
        frame_count:      t.frame_count,
        isLoading:        false,
        framesData:       null,
        videoPhase:
          t.render_path === 'text' || t.render_path === 'interactive'
            ? 'disabled'
            : (t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating')),
        parentSessionId:  t.parent_session_id  ?? null,
        parentFrameIndex: t.parent_frame_index ?? null,
        // Finalize any stage left active in DB (e.g. from sessions before backend fix).
        stages:  t.stages_json  ? JSON.parse(t.stages_json).map(s => s.status === 'active' ? { ...s, status: 'done' } : s)  : [],
        sources: t.sources_json ? JSON.parse(t.sources_json) : [],
        // Interactive turns: blocks populated after getFramesMeta resolves.
        ...(t.render_path === 'interactive' && {
          title:     '',
          followUps: [],
          blocks:    [],
        }),
      }))

      setTurns(loadedTurns)

      // Fetch all turns' frame metadata in parallel — failures are silently
      // swallowed per turn (allSettled) so one bad session doesn't block others.
      await Promise.allSettled(
        loadedTurns.map(async (turn) => {
          const raw = await api.getFramesMeta(turn.id, loadSignal)
          if (loadSignal.aborted || !raw) return

          if (turn.render_path === 'interactive') {
            // raw is scene_ir.json — new format has blocks[], old has explanation+entities.
            const blocks = raw.blocks ?? migrateOldSceneIR(raw)
            setTurns((prev) => prev.map((t) => t.id === turn.id
              ? { ...t, title: raw.title ?? '', followUps: raw.follow_ups ?? [], blocks }
              : t
            ))
          } else {
            setTurns((prev) => prev.map((t) => t.id === turn.id
              ? { ...t, framesData: normalizeFramesData(raw) }
              : t
            ))
          }
        })
      )

      if (loadSignal.aborted) return

      // Resume any video streams that were in-progress when the user last left.
      for (const turn of loadedTurns) {
        if (!loadSignal.aborted && turn.videoPhase === 'generating' && turn.render_path !== 'text') {
          runVideoGenerationForTurn(turn.tempId, turn.id)
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError' && !loadSignal.aborted) {
        toast.error('Failed to load the conversation. Please try again.')
      }
    }
  }, [runVideoGenerationForTurn, abortAllVideoStreams, scrollToTop, toast])

  return {
    bootstrap,
    setBootstrap,
    loadedConvIdRef,
    loadAbortRef,
    loadConversationById,
  }
}
