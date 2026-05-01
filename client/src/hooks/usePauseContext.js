import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Manages the "pause-to-ask" context — the frame reference that is attached to
 * the next generation when the user pauses a video and clicks "Ask about this".
 *
 * Also owns handleLearnAsk, which pre-populates the prompt from the learning
 * canvas (NodeModal "Ask a follow-up") and returns the user to chat view.
 *
 * @param {object}   params
 * @param {Array}    params.turns       - Current turns array (read-only, for frame lookup).
 * @param {Function} params.setPrompt   - React state setter for the prompt string.
 * @param {Function} params.setViewMode - React state setter for 'chat' | 'learn'.
 * @param {object}   params.inputRef    - Ref to the PromptBar <input> element.
 */
export function usePauseContext({ turns, setPrompt, setViewMode, inputRef }) {
  const [pauseContext, setPauseContext] = useState(null)

  // Keep a ref to the latest turns so handlePauseAsk can read the current
  // frame_count / captions without being in its dependency array.
  // Without this, handlePauseAsk would get a new reference on every turn
  // update (videoPhase change, framesData load, etc.) and cause ConversationThread
  // to re-render unnecessarily.
  const turnsRef = useRef(turns)
  useEffect(() => { turnsRef.current = turns }, [turns])

  /**
   * Called when the user pauses a video and clicks "Ask".
   * Derives the frame index from playback position when not provided directly
   * (e.g. when called from the VideoPanel's pause overlay).
   *
   * Stable reference — safe to pass to memoized children.
   */
  const handlePauseAsk = useCallback(({
    sessionId,
    currentTime,
    duration,
    frameIndex: directFrameIndex,
    caption:    directCaption,
  }) => {
    const turn = turnsRef.current.find((t) => t.id === sessionId)
    if (!turn) return

    const frameCount = turn.frame_count || 1
    const frameIndex = directFrameIndex != null
      ? directFrameIndex
      : Math.min(Math.floor((currentTime / duration) * frameCount), frameCount - 1)

    const caption = directCaption ?? turn.framesData?.captions?.[frameIndex] ?? null

    setPauseContext({ sessionId, frameIndex, caption })
    inputRef.current?.focus()
  }, []) // stable — reads turns via ref, inputRef is a stable ref object

  /**
   * Called from the NodeModal "Ask a follow-up" button inside the learning
   * canvas. Pre-fills the prompt and switches back to chat view so the user
   * can submit without leaving the modal flow manually.
   */
  const handleLearnAsk = useCallback(({ question, sessionId, frameIndex, caption }) => {
    setPauseContext({
      sessionId,
      frameIndex: frameIndex ?? undefined,
      caption:    caption    ?? undefined,
    })
    setPrompt(question)
    setViewMode('chat')
    // Delay focus slightly so the view transition completes first.
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [setPrompt, setViewMode, inputRef])

  return {
    pauseContext,
    setPauseContext,
    handlePauseAsk,
    handleLearnAsk,
  }
}
