import { useEffect } from 'react'

/**
 * Orchestrates everything that must happen when the active conversation changes:
 * cancel in-flight generation/load/video work, clear transient context, then
 * either load the new conversation or reset the workspace to the empty state.
 *
 * This is cross-cutting coordination (it touches generation, video, pause, and
 * conversation hooks), so it lives in its own hook rather than inside any single
 * domain hook — keeping Studio's body free of a large lifecycle effect.
 */
export function useConversationSwitch({
  activeConvId,
  loadedConvIdRef,
  loadConversationById,
  loadAbortRef,
  generationAbortRef,
  abortAllVideoStreams,
  resetWorkspace,
  setIsLoadingConversation,
  setPauseContext,
  setSelectedTextContext,
  userScrolledUpRef,
}) {
  useEffect(() => {
    // Clear transient context and cancel any work tied to the previous conversation.
    setPauseContext(null)
    setSelectedTextContext(null)
    generationAbortRef.current?.abort()
    loadAbortRef.current?.abort()

    if (activeConvId && activeConvId !== loadedConvIdRef.current) {
      // Switched to a different conversation — load it.
      abortAllVideoStreams()
      loadedConvIdRef.current = activeConvId
      userScrolledUpRef.current = false
      loadConversationById(activeConvId)
    } else if (!activeConvId && loadedConvIdRef.current !== null) {
      // Left a conversation for a fresh /studio — reset to the empty state.
      abortAllVideoStreams()
      setIsLoadingConversation(false)
      resetWorkspace()
    }
  }, [
    activeConvId,
    loadConversationById,
    abortAllVideoStreams,
    resetWorkspace,
    setPauseContext,
    setSelectedTextContext,
    setIsLoadingConversation,
    generationAbortRef,
    loadAbortRef,
    loadedConvIdRef,
    userScrolledUpRef,
  ])
}
