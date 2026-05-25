import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { normalizeFramesData, migrateOldSceneIR } from '../components/Studio/studioUtils'
import { safeParse, RawConversationSchema } from '../services/schemas'

const CONV_STALE_MS = 30_000 // serve from cache if fetched within last 30 s

/**
 * Manages conversation loading, bootstrap animation state, and the
 * per-conversation load abort signal.
 *
 * React Query is used as the cache layer: the first load for a conversation
 * hits the network; subsequent loads within CONV_STALE_MS are served instantly
 * from cache, eliminating the blank-screen flash on conversation switches.
 *
 * The unified GET /api/conversations/:id endpoint now includes frames_meta
 * inline on every turn, so the old Promise.allSettled parallel fetch loop
 * is gone — each turn's metadata arrives in the initial response.
 */
export function useConversation({
  setTurns,
  runVideoGenerationForTurn,
  abortAllVideoStreams,
  scrollToTop,
  toast,
}) {
  const queryClient = useQueryClient()

  // null = overlay hidden; object = overlay visible with current stage/prompt/frames.
  const [bootstrap, setBootstrap] = useState(null)

  // Tracks which conversation is currently loaded so the switch effect can
  // avoid redundant loads (e.g. when unrelated state causes a re-render).
  const loadedConvIdRef = useRef(null)

  // AbortController for the active load — replaced on every new load so old
  // loads are cleanly cancelled.
  const loadAbortRef = useRef(null)

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
      // fetchQuery returns cached data if it's still fresh (< CONV_STALE_MS old),
      // otherwise fetches from the network. Concurrent calls with the same key
      // are automatically deduplicated by React Query.
      const raw = await queryClient.fetchQuery({
        queryKey: ['conversation', convId],
        queryFn:  () => api.getConversation(convId, loadSignal),
        staleTime: CONV_STALE_MS,
      })

      if (loadSignal.aborted) return
      if (!raw) {
        toast.error('Could not load this conversation. It may have been deleted.')
        return
      }

      const { data, error } = safeParse(RawConversationSchema, raw)
      if (error) {
        console.warn('[useConversation] schema mismatch, proceeding with raw data', error.issues)
      }
      const turns = (data ?? raw).turns ?? []

      const loadedTurns = turns.map((t) => {
        // frames_meta is now inline from the unified endpoint — no separate fetch needed.
        const framesMeta = t.frames_meta ?? null

        // Interactive turns: scene IR content lives in frames_meta.
        let interactiveFields = {}
        if (t.render_path === 'interactive') {
          if (framesMeta) {
            const blocks = framesMeta.blocks ?? migrateOldSceneIR(framesMeta)
            interactiveFields = {
              title:     framesMeta.title     ?? '',
              followUps: framesMeta.follow_ups ?? [],
              blocks,
            }
          } else {
            interactiveFields = { title: '', followUps: [], blocks: [] }
          }
        }

        return {
          tempId:           t.id,
          id:               t.id,
          prompt:           t.prompt,
          intent_type:      t.intent_type,
          render_path:      t.render_path,
          frame_count:      t.frame_count,
          isLoading:        false,
          framesData:
            framesMeta && t.render_path !== 'interactive'
              ? normalizeFramesData(framesMeta)
              : null,
          videoPhase:
            t.render_path === 'text' || t.render_path === 'interactive'
              ? 'disabled'
              : (t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating')),
          parentSessionId:  t.parent_session_id  ?? null,
          parentFrameIndex: t.parent_frame_index ?? null,
          // Finalize any stage left active in DB (from sessions before backend fix).
          stages:  t.stages_json
            ? JSON.parse(t.stages_json).map(s => s.status === 'active' ? { ...s, status: 'done' } : s)
            : [],
          sources: t.sources_json ? JSON.parse(t.sources_json) : [],
          synthesisText:     t.synthesis_text ?? null,
          synthesisComplete: !!t.synthesis_text,
          ...interactiveFields,
        }
      })

      setTurns(loadedTurns)

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
  }, [queryClient, setTurns, runVideoGenerationForTurn, abortAllVideoStreams, scrollToTop, toast])

  return {
    bootstrap,
    setBootstrap,
    loadedConvIdRef,
    loadAbortRef,
    loadConversationById,
  }
}
