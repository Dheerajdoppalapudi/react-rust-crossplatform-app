import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Box, Tooltip, IconButton, Typography, Divider, useTheme } from '@mui/material'
import NotesOutlinedIcon    from '@mui/icons-material/NotesOutlined'
import EditNoteIcon         from '@mui/icons-material/EditNote'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import VideocamOffOutlined  from '@mui/icons-material/VideocamOffOutlined'

import LoadingView         from '../components/Studio/LoadingView'
import EmptyView           from '../components/Studio/EmptyView'
import ConversationThread, { UserBubble } from '../components/Studio/ConversationThread'
import PromptBar           from '../components/Studio/PromptBar'
import LearningView        from '../components/Studio/LearningView/index'
import UserNotesPanel      from '../components/Studio/UserNotesPanel/index'
import ConversationMiniTree from '../components/Studio/ConversationMiniTree'

import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { DEFAULT_MODEL, DEFAULT_RENDER_MODE, FOLLOWUP_SUGGESTIONS } from '../components/Studio/constants'
import { createTempTurn, normalizeFramesData } from '../components/Studio/studioUtils'

export default function Studio({ activeConvId, activeConvTitle, activeConvStarred, onActiveConvIdChange, onConversationsRefresh, onRenameConv, onStarConv, onDeleteConv }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const toast  = useToast()
  const [notesEnabled, setNotesEnabled] = useState(
    () => localStorage.getItem('studio-notes-enabled') === 'true'
  )
  const toggleNotes = () => setNotesEnabled((prev) => {
    const next = !prev
    localStorage.setItem('studio-notes-enabled', String(next))
    return next
  })

  const [videoEnabled, setVideoEnabled] = useState(
    () => localStorage.getItem('studio-video-enabled') !== 'false'
  )
  const toggleVideo = () => setVideoEnabled((prev) => {
    const next = !prev
    localStorage.setItem('studio-video-enabled', String(next))
    return next
  })

  const [userNotesOpen, setUserNotesOpen] = useState(false)
  const toggleUserNotes = () => setUserNotesOpen((prev) => !prev)

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

  const [prompt, setPrompt]                       = useState('')
  const [selectedModel, setSelectedModel]         = useState(DEFAULT_MODEL)
  const [selectedRenderMode, setSelectedRenderMode] = useState(DEFAULT_RENDER_MODE)
  const inputRef           = useRef(null)
  const threadBottomRef    = useRef(null)
  const contentScrollRef   = useRef(null)

  const [turns, setTurns] = useState([])
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [bootstrapStage, setBootstrapStage]   = useState('planning')
  const [bootstrapPrompt, setBootstrapPrompt] = useState('')
  const [bootstrapFrames, setBootstrapFrames] = useState(null)

  const [viewMode, setViewMode] = useState('chat')
  const [pauseContext, setPauseContext] = useState(null)

  const loadedConvIdRef           = useRef(null)
  const generationIdRef           = useRef(0)
  const generationAbortRef        = useRef(null)
  const videoAbortControllersRef  = useRef(new Map())
  const loadAbortRef              = useRef(null)

  const scrollToTop = useCallback(() => {
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0
  }, [])

  const setTurnVideoPhase = useCallback((tempId, sessionId, phase) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.tempId === tempId || (sessionId && t.id === sessionId)
          ? { ...t, videoPhase: phase }
          : t
      )
    )
  }, [])

  const runVideoGenerationForTurn = useCallback(async (tempId, sessionId, onDone) => {
    const controller = new AbortController()
    videoAbortControllersRef.current.set(tempId, controller)

    try {
      await api.generateVideoStream(sessionId, (event) => {
        if (event.type === 'done') {
          setTurnVideoPhase(tempId, sessionId, event.video_path ? 'ready' : 'error')
        } else if (event.type === 'error') {
          setTurnVideoPhase(tempId, sessionId, 'error')
        }
      }, controller.signal)
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

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])

  useEffect(() => {
    const showEmpty = !isBootstrapping && turns.length === 0
    if (showEmpty) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isBootstrapping, turns.length])

  const loadConversationById = useCallback(async (convId) => {
    setTurns([])
    scrollToTop()

    loadAbortRef.current?.abort()
    const loadController = new AbortController()
    loadAbortRef.current = loadController
    const { signal: loadSignal } = loadController

    for (const controller of videoAbortControllersRef.current.values()) {
      controller.abort()
    }
    videoAbortControllersRef.current.clear()

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
        videoPhase:       t.render_path === 'text'
          ? 'disabled'
          : (t.video_path ? 'ready' : (t.status === 'error' ? 'error' : 'generating')),
        parentSessionId:  t.parent_session_id  ?? null,
        parentFrameIndex: t.parent_frame_index ?? null,
      }))

      setTurns(loadedTurns)

      await Promise.allSettled(
        loadedTurns.map(async (turn) => {
          const raw = await api.getFramesMeta(turn.id, loadSignal)
          if (loadSignal.aborted) return
          if (raw) {
            const framesData = normalizeFramesData(raw)
            setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, framesData } : t))
          }
        })
      )

      if (loadSignal.aborted) return

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
  }, [runVideoGenerationForTurn, scrollToTop, toast])

  const loadConversationByIdRef = useRef(loadConversationById)
  loadConversationByIdRef.current = loadConversationById

  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort()
      loadAbortRef.current?.abort()
      for (const controller of videoAbortControllersRef.current.values()) {
        controller.abort()
      }
      loadedConvIdRef.current = null
    }
  }, [])

  useEffect(() => {
    setPauseContext(null)
    generationAbortRef.current?.abort()
    loadAbortRef.current?.abort()

    if (activeConvId && activeConvId !== loadedConvIdRef.current) {
      for (const controller of videoAbortControllersRef.current.values()) {
        controller.abort()
      }
      videoAbortControllersRef.current.clear()
      loadedConvIdRef.current = activeConvId
      loadConversationByIdRef.current(activeConvId)
    } else if (!activeConvId && loadedConvIdRef.current !== null) {
      for (const controller of videoAbortControllersRef.current.values()) {
        controller.abort()
      }
      videoAbortControllersRef.current.clear()
      loadedConvIdRef.current = null
      setTurns([])
      setPrompt('')
      setIsBootstrapping(false)
      scrollToTop()
    }
  }, [activeConvId, scrollToTop])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isBootstrapping || turns.some((t) => t.isLoading)) return

    const submittedPrompt = prompt.trim()
    setPrompt('')

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const tempId      = `temp_${Date.now()}`
    const isFirstTurn = !activeConvId

    const parentSessionId = isFirstTurn
      ? null
      : (pauseContext?.sessionId ?? turns.filter((t) => t.id).at(-1)?.id ?? null)

    if (isFirstTurn) {
      setIsBootstrapping(true)
      setBootstrapStage('planning')
      setBootstrapPrompt(submittedPrompt)
      setTurns([])
      scrollToTop()
    } else {
      setTurns((prev) => [...prev, createTempTurn({
        tempId,
        prompt:           submittedPrompt,
        videoEnabled,
        parentSessionId,
        parentFrameIndex: pauseContext?.frameIndex ?? null,
      })])
    }

    const t1  = (isFirstTurn && videoEnabled)  ? setTimeout(() => setBootstrapStage('generating'), 2500) : null
    const t2  = (isFirstTurn && videoEnabled)  ? setTimeout(() => setBootstrapStage('rendering'),  6000) : null
    const it1 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'generating' } : t)), 2500) : null
    const it2 = !isFirstTurn ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'rendering' }  : t)), 6000) : null

    const capturedPauseContext = pauseContext
    setPauseContext(null)

    try {
      const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode.id : null
      const data = await api.imageGeneration(
        submittedPrompt, activeConvId, capturedPauseContext,
        notesEnabled, selectedModel.provider, selectedModel.model,
        genController.signal, renderModeId, parentSessionId, !videoEnabled,
      )

      if (isStale()) return

      const framesData = normalizeFramesData(data)
      const realTurn = {
        tempId,
        id:                  data.session_id,
        conversation_id:     data.conversation_id,
        turn_index:          data.turn_index,
        prompt:              submittedPrompt,
        intent_type:         data.intent_type,
        render_path:         data.render_path,
        frame_count:         data.frame_count,
        isLoading:           false,
        stage:               null,
        framesData,
        videoPhase:          videoEnabled ? 'generating' : 'disabled',
        parentSessionId:     parentSessionId,
        parentFrameIndex:    capturedPauseContext?.frameIndex ?? null,
      }

      if (isFirstTurn) {
        loadedConvIdRef.current = data.conversation_id
        onActiveConvIdChange(data.conversation_id)
        setBootstrapStage('frames')
        setBootstrapFrames({ framesData, sessionId: data.session_id })
        setTurns([realTurn])
        await onConversationsRefresh()
        if (videoEnabled) {
          setBootstrapStage('video')
          runVideoGenerationForTurn(tempId, data.session_id, () => {
            setIsBootstrapping(false)
            setBootstrapFrames(null)
          })
        } else {
          setIsBootstrapping(false)
          setBootstrapFrames(null)
        }
      } else {
        setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
        await onConversationsRefresh()
        if (videoEnabled) runVideoGenerationForTurn(tempId, data.session_id)
      }
    } catch (err) {
      console.error('[Studio] handleGenerate:', err)
      toast.error('Generation failed. Please try again.')
      if (isFirstTurn) {
        setIsBootstrapping(false)
        setTurns([])
        onActiveConvIdChange(null)
      } else {
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      if (t1)  clearTimeout(t1)
      if (t2)  clearTimeout(t2)
      if (it1) clearTimeout(it1)
      if (it2) clearTimeout(it2)
    }
  }, [
    prompt, isBootstrapping, turns, activeConvId, notesEnabled, videoEnabled,
    pauseContext, selectedModel, selectedRenderMode, onActiveConvIdChange,
    onConversationsRefresh, runVideoGenerationForTurn, scrollToTop, toast,
  ])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }, [handleGenerate])

  const handleNewConversation = useCallback(() => {
    loadedConvIdRef.current = null
    onActiveConvIdChange(null)
    setTurns([])
    setPrompt('')
    setIsBootstrapping(false)
    scrollToTop()
    inputRef.current?.focus()
  }, [onActiveConvIdChange, scrollToTop])

  const handlePauseAsk = useCallback(({ sessionId, currentTime, duration, frameIndex: directFrameIndex, caption: directCaption }) => {
    const turn = turns.find((t) => t.id === sessionId)
    if (!turn) return
    const frameCount = turn.frame_count || 1
    const frameIndex = directFrameIndex != null
      ? directFrameIndex
      : Math.min(Math.floor((currentTime / duration) * frameCount), frameCount - 1)
    const caption = directCaption ?? turn.framesData?.captions?.[frameIndex] ?? null
    setPauseContext({ sessionId, frameIndex, caption })
    inputRef.current?.focus()
  }, [turns])

  const lastTurn = turns.filter((t) => t.intent_type).at(-1) ?? null
  const activeConversationMeta = useMemo(() => activeConvId ? {
    id:                  activeConvId,
    intent_type:         lastTurn?.intent_type  ?? null,
    suggested_followups: lastTurn?.framesData?.suggested_followups ?? [],
  } : null, [activeConvId, lastTurn])

  const isAnyGenerating = isBootstrapping || turns.some((t) => t.isLoading)
  const showEmpty       = !isBootstrapping && turns.length === 0
  const showLoader      = isBootstrapping
  const showThread      = !isBootstrapping && turns.length > 0

  const followUpSuggestions = useMemo(() => {
    const isFollowUp = showThread && !!activeConvId && !isAnyGenerating && !pauseContext
    if (!isFollowUp) return []
    return activeConversationMeta?.suggested_followups?.length
      ? activeConversationMeta.suggested_followups
      : (FOLLOWUP_SUGGESTIONS[activeConversationMeta?.intent_type] || FOLLOWUP_SUGGESTIONS.illustration)
  }, [showThread, activeConvId, isAnyGenerating, pauseContext, activeConversationMeta])

  const handleSuggestionClick = useCallback((s) => {
    setPrompt(s)
    inputRef.current?.focus()
  }, [])

  const handleLearnAsk = useCallback(({ question, sessionId, frameIndex, caption }) => {
    setPauseContext({ sessionId, frameIndex: frameIndex ?? undefined, caption: caption ?? undefined })
    setPrompt(question)
    setViewMode('chat')
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  const handleLearnGenerate = useCallback(async ({ question, sessionId }) => {
    if (!activeConvId || !question.trim()) return

    const thisGenId = ++generationIdRef.current
    const isStale   = () => generationIdRef.current !== thisGenId

    generationAbortRef.current?.abort()
    const genController = new AbortController()
    generationAbortRef.current = genController

    const tempId           = `temp_${Date.now()}`
    const capturedPauseCtx = { sessionId, frameIndex: undefined, caption: undefined }

    setTurns((prev) => [...prev, createTempTurn({
      tempId,
      prompt:          question,
      videoEnabled,
      parentSessionId: sessionId ?? null,
      parentFrameIndex: null,
    })])

    const it1 = videoEnabled ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'generating' } : t)), 2500) : null
    const it2 = videoEnabled ? setTimeout(() =>
      setTurns((p) => p.map((t) => t.tempId === tempId ? { ...t, stage: 'rendering'  } : t)), 6000) : null

    try {
      const renderModeId = selectedRenderMode?.id !== 'auto' ? selectedRenderMode.id : null
      const data = await api.imageGeneration(
        question, activeConvId, capturedPauseCtx,
        notesEnabled, selectedModel.provider, selectedModel.model,
        genController.signal, renderModeId, null, !videoEnabled,
      )

      if (isStale()) return

      const framesData = normalizeFramesData(data)
      const realTurn = {
        tempId,
        id:               data.session_id,
        conversation_id:  data.conversation_id,
        turn_index:       data.turn_index,
        prompt:           question,
        intent_type:      data.intent_type,
        render_path:      data.render_path,
        frame_count:      data.frame_count,
        isLoading:        false,
        stage:            null,
        framesData,
        videoPhase:       videoEnabled ? 'generating' : 'disabled',
        parentSessionId:  capturedPauseCtx.sessionId ?? null,
        parentFrameIndex: null,
      }

      setTurns((prev) => prev.map((t) => t.tempId === tempId ? realTurn : t))
      await onConversationsRefresh()
      if (videoEnabled) runVideoGenerationForTurn(tempId, data.session_id)
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[Studio] handleLearnGenerate:', err)
        toast.error('Generation failed. Please try again.')
        setTurns((prev) => prev.map((t) =>
          t.tempId === tempId ? { ...t, isLoading: false, videoPhase: 'error' } : t
        ))
      }
    } finally {
      clearTimeout(it1)
      clearTimeout(it2)
    }
  }, [activeConvId, notesEnabled, videoEnabled, selectedModel, selectedRenderMode,
      onConversationsRefresh, runVideoGenerationForTurn, toast])

  const handleExitLearnView    = useCallback(() => setViewMode('chat'), [])
  const handleMiniTreeNavigate = useCallback((tempId) => {
    document.querySelector(`[data-turn-id="${tempId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (viewMode === 'learn') {
    return (
      <LearningView
        turns={turns}
        conversationId={activeConvId}
        onExit={handleExitLearnView}
        onAskFromLearn={handleLearnAsk}
        onGenerateFromCanvas={handleLearnGenerate}
      />
    )
  }

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

      <Box sx={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 0.75,
        bgcolor: isDark ? 'rgba(26,26,26,0.85)' : 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '10px',
        px: 0.75, py: 0.5,
        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.08)',
      }}>
        <Box sx={{
          display: 'flex',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          borderRadius: '7px', p: 0.25, gap: 0.2,
        }}>
          {['Chat', 'Learn'].map((label) => {
            const m      = label.toLowerCase()
            const active = viewMode === m
            return (
              <Box
                key={m}
                onClick={() => setViewMode(m)}
                sx={{
                  px: 1.25, py: 0.35, borderRadius: '5px', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, userSelect: 'none',
                  bgcolor: active ? theme.palette.primary.main : 'transparent',
                  color:   active ? '#fff' : theme.palette.text.secondary,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Box>
            )
          })}
        </Box>

        <Tooltip title={notesEnabled ? 'AI Notes on' : 'AI Notes off'}>
          <IconButton
            size="small"
            onClick={toggleNotes}
            aria-pressed={notesEnabled}
            sx={{
              borderRadius: '7px', p: 0.6,
              border: `1px solid ${notesEnabled
                ? (isDark ? 'rgba(79,110,255,0.45)' : '#c7d2fe')
                : (isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0')}`,
              color: notesEnabled
                ? theme.palette.primary.main
                : (isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'),
              bgcolor: notesEnabled
                ? (isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff')
                : 'transparent',
              '&:hover': {
                borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
                color: notesEnabled ? theme.palette.primary.main : (isDark ? '#fff' : '#374151'),
              },
              transition: 'all 0.15s',
            }}
          >
            <NotesOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={videoEnabled ? 'Video on' : 'Video off'}>
          <IconButton
            size="small"
            onClick={toggleVideo}
            aria-pressed={videoEnabled}
            sx={{
              borderRadius: '7px', p: 0.6,
              border: `1px solid ${videoEnabled
                ? (isDark ? 'rgba(79,110,255,0.45)' : '#c7d2fe')
                : (isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0')}`,
              color: videoEnabled
                ? theme.palette.primary.main
                : (isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'),
              bgcolor: videoEnabled
                ? (isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff')
                : 'transparent',
              '&:hover': {
                borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
                color: videoEnabled ? theme.palette.primary.main : (isDark ? '#fff' : '#374151'),
              },
              transition: 'all 0.15s',
            }}
          >
            {videoEnabled
              ? <VideocamOutlinedIcon sx={{ fontSize: 15 }} />
              : <VideocamOffOutlined  sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title={`My Notes (${navigator.platform.toUpperCase().includes('MAC') ? '⇧⌘N' : 'Ctrl+Shift+N'})`}>
          <IconButton
            size="small"
            onClick={toggleUserNotes}
            aria-pressed={userNotesOpen}
            sx={{
              borderRadius: '7px', p: 0.6,
              border: `1px solid ${userNotesOpen
                ? (isDark ? 'rgba(79,110,255,0.45)' : '#c7d2fe')
                : (isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0')}`,
              color: userNotesOpen
                ? theme.palette.primary.main
                : (isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8'),
              bgcolor: userNotesOpen
                ? (isDark ? 'rgba(79,110,255,0.1)' : '#f0f4ff')
                : 'transparent',
              '&:hover': {
                borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
                color: userNotesOpen ? theme.palette.primary.main : (isDark ? '#fff' : '#374151'),
              },
              transition: 'all 0.15s',
            }}
          >
            <EditNoteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

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
            <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3 }}>
              {bootstrapPrompt && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, pb: 1.5 }}>
                  <UserBubble prompt={bootstrapPrompt} />
                </Box>
              )}
              <LoadingView stage={bootstrapStage} framesData={bootstrapFrames} textMode={!videoEnabled} />
            </Box>
          )}

          {showEmpty && (
            <EmptyView onSuggestionClick={handleSuggestionClick} />
          )}

          {showThread && (
            <>
              <ConversationThread
                turns={turns}
                onPauseAsk={handlePauseAsk}
                onRetryTurn={handleRetryTurn}
                onSuggestionClick={handleSuggestionClick}
              />

              {followUpSuggestions.length > 0 && (
                <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: 3, pt: 2, pb: 3 }}>
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

        <PromptBar
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={handleGenerate}
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
        />
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
