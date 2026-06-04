import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { normalizeFramesData, migrateOldSceneIR } from '../components/Studio/studioUtils'
import { safeParse, RawConversationSchema } from '../services/schemas'
import { getSessionMediaToken } from '../services/mediaToken'


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

  // true while a conversation is being fetched — prevents EmptyView flash during switch
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)

  // Tracks which conversation is currently loaded so the switch effect can
  // avoid redundant loads (e.g. when unrelated state causes a re-render).
  const loadedConvIdRef = useRef(null)

  // AbortController for the active load — replaced on every new load so old
  // loads are cleanly cancelled.
  const loadAbortRef = useRef(null)

  const loadConversationById = useCallback(async (convId) => {
    setTurns([])
    scrollToTop()
    setIsLoadingConversation(true)

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
        const meta = t.frames_meta ?? null
        const isInteractive = t.render_path === 'interactive'

        const interactiveFields = isInteractive ? {
          title:     meta?.title      ?? '',
          followUps: meta?.follow_ups ?? [],
          blocks:    meta ? (meta.blocks ?? migrateOldSceneIR(meta)) : [],
        } : {}

        return {
          tempId:           t.id,
          id:               t.id,
          prompt:           t.prompt,
          intent_type:      t.intent_type,
          render_path:      t.render_path,
          frame_count:      t.frame_count,
          isLoading:        false,
          framesData:       (!isInteractive && meta) ? normalizeFramesData(meta) : null,
          videoPhase:
            t.render_path === 'text' || isInteractive
              ? 'disabled'
              : (t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating')),
          parentSessionId:  t.parent_session_id  ?? null,
          parentFrameIndex: t.parent_frame_index ?? null,
          stages:  Array.isArray(t.stages_json)
            ? t.stages_json.map(s => s.status === 'active' ? { ...s, status: 'done' } : s)
            : [],
          sources: Array.isArray(t.sources_json) ? t.sources_json : [],
          synthesisText:     t.synthesis_text ?? null,
          synthesisComplete: !!t.synthesis_text,
          ...interactiveFields,
        }
      })

      setTurns(loadedTurns)

      if (loadSignal.aborted) return

      // Prefetch media tokens for all video-ready turns so the token cache is
      // warm before video players mount — avoids a 3s RTT on first playback.
      // Fire-and-forget: failures are non-fatal (token will be fetched on demand).
      for (const turn of loadedTurns) {
        if (turn.videoPhase === 'ready') {
          getSessionMediaToken(turn.id).catch(() => {})
        }
      }

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
    } finally {
      if (!loadSignal.aborted) setIsLoadingConversation(false)
    }
  }, [queryClient, setTurns, runVideoGenerationForTurn, abortAllVideoStreams, scrollToTop, toast])

  return {
    bootstrap,
    setBootstrap,
    isLoadingConversation,
    setIsLoadingConversation,
    loadedConvIdRef,
    loadAbortRef,
    loadConversationById,
  }
}
