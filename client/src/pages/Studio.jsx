import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Box, Typography, Divider, useTheme, useMediaQuery } from '@mui/material'
import { useMobileHeaderSlot } from '../App'
import StudioToolbar from '../components/Studio/StudioToolbar'

import LoadingView          from '../components/Studio/LoadingView'
import EmptyView            from '../components/Studio/EmptyView'
import ConversationThread, { UserBubble } from '../components/Studio/ConversationThread'
import PromptBar            from '../components/Studio/PromptBar'
import LearningView         from '../components/Studio/LearningView/index'
import UserNotesPanel       from '../components/Studio/UserNotesPanel/index'
import ConversationMiniTree from '../components/Studio/ConversationMiniTree'

import { useToast }         from '../contexts/ToastContext'
import { DEFAULT_MODEL, DEFAULT_RENDER_MODE, DEFAULT_MODE, FOLLOWUP_SUGGESTIONS, MODES } from '../components/Studio/constants'
import { STORAGE_KEYS } from '../constants/storage.js'

import { useVideoStream }   from '../hooks/useVideoStream'
import { usePauseContext }  from '../hooks/usePauseContext'
import { useConversation }  from '../hooks/useConversation'
import { useGeneration }    from '../hooks/useGeneration'

export default function Studio({
  activeConvId,
  onActiveConvIdChange,
  onConversationsRefresh,
}) {
  const theme    = useTheme()
  const isDark   = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const toast    = useToast()
  const { setSlot } = useMobileHeaderSlot()

  // ── Persisted preferences ───────────────────────────────────────────────────

  const [notesEnabled, setNotesEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEYS.NOTES_ENABLED) === 'true'
  )
  const toggleNotes = useCallback(() => setNotesEnabled((prev) => {
    const next = !prev
    localStorage.setItem(STORAGE_KEYS.NOTES_ENABLED, String(next))
    return next
  }), [])

  const [videoEnabled, setVideoEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEYS.VIDEO_ENABLED) !== 'false'
  )
  const toggleVideo = useCallback(() => setVideoEnabled((prev) => {
    const next = !prev
    localStorage.setItem(STORAGE_KEYS.VIDEO_ENABLED, String(next))
    return next
  }), [])

  const [userNotesOpen, setUserNotesOpen] = useState(false)
  const toggleUserNotes = useCallback(() => setUserNotesOpen((prev) => !prev), [])

  // ── Core state ──────────────────────────────────────────────────────────────

  const [prompt, setPrompt]                         = useState('')
  const [selectedModel, setSelectedModel]           = useState(DEFAULT_MODEL)
  const [selectedRenderMode, setSelectedRenderMode] = useState(DEFAULT_RENDER_MODE)
  const [selectedMode, setSelectedMode]             = useState(DEFAULT_MODE)
  const [stagedFiles, setStagedFiles]               = useState([])
  const [turns, setTurns]                           = useState([])
  const [viewMode, setViewMode]                     = useState('chat')

  const inputRef        = useRef(null)
  const threadBottomRef = useRef(null)
  const contentScrollRef = useRef(null)

  const scrollToTop = useCallback(() => {
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
  }, [])

  // ── Custom hooks ────────────────────────────────────────────────────────────

  const {
    runVideoGenerationForTurn,
    handleRetryTurn,
    abortAll: abortAllVideoStreams,
  } = useVideoStream({ setTurns, toast })

  const {
    pauseContext,
    setPauseContext,
    handlePauseAsk,
    handleLearnAsk,
  } = usePauseContext({ turns, setPrompt, setViewMode, inputRef })

  const {
    bootstrap,
    setBootstrap,
    loadedConvIdRef,
    loadAbortRef,
    loadConversationById,
  } = useConversation({ setTurns, runVideoGenerationForTurn, abortAllVideoStreams, scrollToTop, toast })

  // Derived bootstrap values — kept out of render so Studio.jsx stays declarative.
  const isBootstrapping  = bootstrap !== null
  const bootstrapStage   = bootstrap?.stage  ?? 'planning'
  const bootstrapPrompt  = bootstrap?.prompt ?? ''
  const bootstrapFrames  = bootstrap?.frames ?? null

  // Memoized derived scalars — O(n) scans run only when turns change, not on
  // every render triggered by unrelated state (prompt, viewMode, etc.).
  const isAnyGenerating    = useMemo(() => isBootstrapping || turns.some((t) => t.isLoading), [isBootstrapping, turns])
  const lastCompletedTurnId = useMemo(() => turns.filter((t) => t.id).at(-1)?.id ?? null, [turns])

  const {
    handleGenerate,
    handleLearnGenerate,
    handleRetryGeneration,
    generationAbortRef,
  } = useGeneration({
    activeConvId,
    loadedConvIdRef,
    onActiveConvIdChange,
    onConversationsRefresh,
    isAnyGenerating,
    lastCompletedTurnId,
    setTurns,
    prompt,
    setPrompt,
    videoEnabled,
    notesEnabled,
    selectedModel,
    selectedRenderMode,
    selectedMode,
    stagedFiles,
    pauseContext,
    setPauseContext,
    setBootstrap,
    runVideoGenerationForTurn,
    scrollToTop,
    toast,
  })

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Cmd/Ctrl+Shift+N toggles the user notes panel.
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const handleKey = (e) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setUserNotesOpen((p) => !p)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Warn before tab/window close while a generation is in-flight.
  useEffect(() => {
    if (!isAnyGenerating) return
    const guard = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [isAnyGenerating])

  // Auto-scroll to the latest turn when a new one is appended.
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])

  // Focus the prompt bar when the thread is empty (new conversation).
  useEffect(() => {
    if (!isBootstrapping && turns.length === 0) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isBootstrapping, turns.length])

  // Conversation switch: cancel in-flight work, then load the new conversation.
  useEffect(() => {
    setPauseContext(null)
    generationAbortRef.current?.abort()
    loadAbortRef.current?.abort()

    if (activeConvId && activeConvId !== loadedConvIdRef.current) {
      abortAllVideoStreams()
      loadedConvIdRef.current = activeConvId
      loadConversationById(activeConvId)
    } else if (!activeConvId && loadedConvIdRef.current !== null) {
      abortAllVideoStreams()
      loadedConvIdRef.current = null
      setTurns([])
      setPrompt('')
      setBootstrap(null)
      scrollToTop()
    }
  }, [
    activeConvId,
    loadConversationById,
    abortAllVideoStreams,
    scrollToTop,
    setPauseContext,
    setBootstrap,
    generationAbortRef,
    loadAbortRef,
    loadedConvIdRef,
  ])

  // Cancel all in-flight requests on unmount.
  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort()
      loadAbortRef.current?.abort()
      abortAllVideoStreams()
      loadedConvIdRef.current = null
    }
  }, [abortAllVideoStreams, generationAbortRef, loadAbortRef, loadedConvIdRef])

  // Push toolbar controls into the mobile header slot.
  useEffect(() => {
    if (!isMobile) { setSlot(null); return }
    setSlot(
      <StudioToolbar
        compact
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        notesEnabled={notesEnabled}
        onToggleNotes={toggleNotes}
        videoEnabled={videoEnabled}
        onToggleVideo={toggleVideo}
        userNotesOpen={userNotesOpen}
        onToggleUserNotes={toggleUserNotes}
      />
    )
    return () => setSlot(null)
  }, [isMobile, viewMode, notesEnabled, videoEnabled, userNotesOpen,
      setSlot, toggleNotes, toggleVideo, toggleUserNotes, setViewMode])

  // ── Derived state ───────────────────────────────────────────────────────────

  const lastTurn = turns.at(-1) ?? null

  const activeConversationMeta = useMemo(() => activeConvId ? {
    id:                  activeConvId,
    intent_type:         lastTurn?.intent_type ?? null,
    suggested_followups: lastTurn?.render_path === 'interactive'
      ? (lastTurn?.followUps ?? [])
      : (lastTurn?.framesData?.suggested_followups ?? []),
  } : null, [activeConvId, lastTurn])

  const showLoader = isBootstrapping
  const showEmpty  = !isBootstrapping && turns.length === 0
  const showThread = !isBootstrapping && turns.length > 0

  const followUpSuggestions = useMemo(() => {
    const lt            = turns[turns.length - 1]
    const lastErrored   = lt?.videoPhase === 'error'
    const isFollowUp    = showThread && !!activeConvId && !isAnyGenerating && !pauseContext && !lastErrored
    if (!isFollowUp) return []
    return activeConversationMeta?.suggested_followups?.length
      ? activeConversationMeta.suggested_followups
      : (FOLLOWUP_SUGGESTIONS[activeConversationMeta?.intent_type] || FOLLOWUP_SUGGESTIONS.illustration)
  }, [showThread, activeConvId, isAnyGenerating, pauseContext, activeConversationMeta, turns])

  // ── Event handlers (Studio-local concerns) ──────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }, [handleGenerate])

  const handleNewConversation = useCallback(() => {
    loadedConvIdRef.current = null
    onActiveConvIdChange(null)
    setTurns([])
    setPrompt('')
    setBootstrap(null)
    scrollToTop()
    inputRef.current?.focus()
  }, [onActiveConvIdChange, scrollToTop, setBootstrap, loadedConvIdRef])

  const handleSuggestionClick = useCallback((s) => {
    setPrompt(s)
    // Suggestions on the empty state are research-oriented — switch to deep research
    setSelectedMode(MODES.find(m => m.id === 'deep_research') ?? DEFAULT_MODE)
    inputRef.current?.focus()
  }, [])

  const handleAddFiles = useCallback((files) => {
    setStagedFiles(prev => [...prev, ...files.filter(f => !prev.find(p => p.id === f.id))])
  }, [])

  const handleRemoveFile = useCallback((id) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleMiniTreeNavigate = useCallback((tempId) => {
    document.querySelector(`[data-turn-id="${tempId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // ── Learning canvas (full-screen takeover) ──────────────────────────────────

  if (viewMode === 'learn') {
    return (
      <LearningView
        turns={turns}
        conversationId={activeConvId}
        onExit={() => setViewMode('chat')}
        onAskFromLearn={handleLearnAsk}
        onGenerateFromCanvas={handleLearnGenerate}
        defaultModel={selectedModel}
        defaultVideoEnabled={videoEnabled}
      />
    )
  }

  // ── Chat view ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{
      height: '100%',
      display: 'flex', flexDirection: 'row',
      overflow: 'hidden',
      bgcolor: 'background.default',
    }}>

      <Box sx={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        minWidth: 0,
      }}>

        {/* ── Toolbar — hidden on mobile (controls move to MobileHeader slot) ── */}
        <Box sx={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.75,
          bgcolor: isDark ? 'rgba(26,26,26,0.85)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: '10px',
          px: { xs: 0.5, sm: 0.75 }, py: 0.5,
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          <StudioToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            notesEnabled={notesEnabled}
            onToggleNotes={toggleNotes}
            videoEnabled={videoEnabled}
            onToggleVideo={toggleVideo}
            userNotesOpen={userNotesOpen}
            onToggleUserNotes={toggleUserNotes}
          />
        </Box>

        {/* ── Content area ────────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <Box
            ref={contentScrollRef}
            sx={{
              flex: 1, overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: 2 },
            }}
          >
            {showLoader && (
              <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 } }}>
                {bootstrapPrompt && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 1.5 }}>
                    <UserBubble prompt={bootstrapPrompt} />
                  </Box>
                )}
                <LoadingView
                  stage={bootstrapStage}
                  framesData={bootstrapFrames}
                  mode={!videoEnabled ? 'interactive' : undefined}
                  textMode={false}
                />
              </Box>
            )}

            {showEmpty && (
              <EmptyView
                onSuggestionClick={handleSuggestionClick}
                prompt={prompt}
                onPromptChange={setPrompt}
                onSubmit={handleGenerate}
                onStop={() => generationAbortRef.current?.abort()}
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
                isGenerating={isAnyGenerating}
                activeConversation={activeConversationMeta}
                onNewConversation={handleNewConversation}
                pauseContext={pauseContext}
                onClearPauseContext={() => setPauseContext(null)}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                selectedRenderMode={selectedRenderMode}
                onRenderModeChange={setSelectedRenderMode}
                selectedMode={selectedMode}
                onModeChange={setSelectedMode}
                stagedFiles={stagedFiles}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
              />
            )}

            {showThread && (
              <>
                <ConversationThread
                  turns={turns}
                  onPauseAsk={handlePauseAsk}
                  onRetryTurn={handleRetryTurn}
                  onRetryGeneration={handleRetryGeneration}
                />

                {followUpSuggestions.length > 0 && (
                  <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, pt: 2, pb: 3 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.secondary, mb: 0.5 }}>
                      Follow-ups
                    </Typography>
                    {followUpSuggestions.map((s, i) => (
                      <Box key={s}>
                        {i > 0 && <Divider sx={{ opacity: 0.2 }} />}
                        <Box
                          onClick={() => handleSuggestionClick(s)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            py: 0.9, px: 0.5, cursor: 'pointer', userSelect: 'none',
                            color: theme.palette.text.secondary,
                            '&:hover': { color: theme.palette.text.primary },
                            transition: 'color 0.15s',
                          }}
                        >
                          <Typography sx={{ fontSize: 14.5, opacity: 0.35, flexShrink: 0, lineHeight: 1 }}>↳</Typography>
                          <Typography sx={{ fontSize: 14.5, fontWeight: 400, lineHeight: 1.6 }}>{s}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box ref={threadBottomRef} sx={{ height: 1 }} />
              </>
            )}
          </Box>

          {!showEmpty && (
            <PromptBar
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleGenerate}
              onStop={() => generationAbortRef.current?.abort()}
              onKeyDown={handleKeyDown}
              inputRef={inputRef}
              isGenerating={isAnyGenerating}
              activeConversation={activeConversationMeta}
              onNewConversation={handleNewConversation}
              pauseContext={pauseContext}
              onClearPauseContext={() => setPauseContext(null)}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              selectedRenderMode={selectedRenderMode}
              onRenderModeChange={setSelectedRenderMode}
              selectedMode={selectedMode}
              onModeChange={setSelectedMode}
              stagedFiles={stagedFiles}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
            />
          )}
        </Box>

        {showThread && (
          <ConversationMiniTree turns={turns} onNavigate={handleMiniTreeNavigate} />
        )}

      </Box>

      <UserNotesPanel
        conversationId={activeConvId}
        isOpen={userNotesOpen}
      />

    </Box>
  )
}
