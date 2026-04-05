import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, IconButton, Skeleton, Tooltip, Divider, useTheme, useMediaQuery, Drawer } from '@mui/material'
import CloseIcon       from '@mui/icons-material/Close'
import EditNoteIcon    from '@mui/icons-material/EditNote'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit    from '@tiptap/starter-kit'
import Underline     from '@tiptap/extension-underline'
import Link          from '@tiptap/extension-link'
import TaskList      from '@tiptap/extension-task-list'
import TaskItem      from '@tiptap/extension-task-item'
import Table         from '@tiptap/extension-table'
import TableRow      from '@tiptap/extension-table-row'
import TableHeader   from '@tiptap/extension-table-header'
import TableCell     from '@tiptap/extension-table-cell'
import Placeholder   from '@tiptap/extension-placeholder'

import { api }           from '../../../services/api'
import { useToast }      from '../../../contexts/ToastContext'
import { getEditorSx }   from './editorStyles'
import BubbleToolbar     from './BubbleToolbar'
import SlashMenu         from './SlashMenu'
import SaveIndicator     from './SaveIndicator'

const PANEL_WIDTH   = 440
const DEBOUNCE_MS   = 1500
const SAVED_RESET   = 3000  // ms before 'saved' reverts to 'idle'

// ─── UserNotesPanel ───────────────────────────────────────────────────────────
export default function UserNotesPanel({ conversationId, isOpen }) {
  const theme     = useTheme()
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'))
  const toast     = useToast()

  const [saveStatus,  setSaveStatus]  = useState('idle')    // 'idle'|'unsaved'|'saving'|'saved'|'error'
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [isLoading,   setIsLoading]   = useState(false)

  const debounceRef  = useRef(null)
  const savedResetRef = useRef(null)
  const pendingRef   = useRef(false)     // true while unsaved changes exist
  const convIdRef    = useRef(null)      // tracks the convId in-flight saves belong to

  // ── TipTap editor ─────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Start writing, or type '/' for commands" }),
    ],
    content: '',
    onUpdate: ({ editor: e }) => {
      // Skip if the update came from loading content (not user typing)
      if (e.isEmpty && saveStatus === 'idle') return
      setSaveStatus('unsaved')
      pendingRef.current = true
      scheduleSave(e)
    },
    editorProps: {
      attributes: { spellcheck: 'true' },
    },
  })

  // ── Debounced save ────────────────────────────────────────────────────────────
  const performSave = useCallback(async (editorInstance) => {
    const targetConvId = convIdRef.current
    if (!targetConvId || !editorInstance) return
    setSaveStatus('saving')
    try {
      const json = JSON.stringify(editorInstance.getJSON())
      const result = await api.updateConversationNotes(targetConvId, json)
      if (result?.updated_at) {
        setLastSavedAt(result.updated_at)
      }
      setSaveStatus('saved')
      pendingRef.current = false
      clearTimeout(savedResetRef.current)
      savedResetRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_RESET)
    } catch {
      setSaveStatus('error')
      toast.error('Could not save notes. Please try again.')
    }
  }, [toast])

  const scheduleSave = useCallback((editorInstance) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => performSave(editorInstance), DEBOUNCE_MS)
  }, [performSave])

  // ── Load notes when conversation changes ─────────────────────────────────────
  useEffect(() => {
    // Flush any pending save for the previous conversation before switching
    if (pendingRef.current && debounceRef.current && convIdRef.current && editor) {
      clearTimeout(debounceRef.current)
      performSave(editor)
    }

    // Reset
    clearTimeout(debounceRef.current)
    clearTimeout(savedResetRef.current)
    setSaveStatus('idle')
    setLastSavedAt(null)
    pendingRef.current = false
    convIdRef.current  = conversationId

    if (!conversationId || !editor) return

    setIsLoading(true)
    api.getConversationNotes(conversationId).then((data) => {
      setIsLoading(false)
      if (!data || data.content === null) {
        editor.commands.setContent('')
        return
      }
      try {
        const json = JSON.parse(data.content)
        editor.commands.setContent(json, false) // false = don't trigger onUpdate
        setLastSavedAt(data.updated_at)
      } catch {
        editor.commands.setContent('')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Flush on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      clearTimeout(savedResetRef.current)
      if (pendingRef.current && editor && convIdRef.current) {
        performSave(editor)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Shared inner content ──────────────────────────────────────────────────────
  const panelContent = (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      bgcolor: 'background.paper',
    }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        px: 2, py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}>
        <EditNoteIcon sx={{ fontSize: 17, color: 'text.secondary', mr: 0.75 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', flex: 1 }}>
          My Notes
        </Typography>
        {isMobile && (
          <Tooltip title="Close">
            <IconButton size="small" onClick={() => {}} sx={{ p: 0.4 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Empty / no conversation state */}
      {!conversationId && (
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          px: 3, gap: 1,
        }}>
          <EditNoteIcon sx={{ fontSize: 32, color: 'text.disabled', opacity: 0.4 }} />
          <Typography sx={{ fontSize: 13, color: 'text.disabled', textAlign: 'center', lineHeight: 1.5 }}>
            Open a conversation to start taking notes
          </Typography>
        </Box>
      )}

      {/* Loading skeleton */}
      {conversationId && isLoading && (
        <Box sx={{ px: 2.5, py: 2.5, flex: 1 }}>
          <Skeleton variant="text" width="70%"  height={20} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="90%"  height={16} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="55%"  height={16} />
        </Box>
      )}

      {/* Editor */}
      {conversationId && !isLoading && editor && (
        <>
          <BubbleToolbar editor={editor} />
          <SlashMenu editor={editor} />
          <Box sx={getEditorSx(theme)}>
            <EditorContent editor={editor} />
          </Box>
        </>
      )}

      {/* Footer */}
      {conversationId && (
        <>
          <Divider />
          <Box sx={{
            px: 2, py: 0.9, display: 'flex', alignItems: 'center',
            flexShrink: 0, minHeight: 34,
          }}>
            <SaveIndicator saveStatus={saveStatus} lastSavedAt={lastSavedAt} />
          </Box>
        </>
      )}
    </Box>
  )

  // ── Mobile: bottom sheet drawer ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={isOpen}
        onClose={() => {}}
        PaperProps={{
          sx: {
            height: '65vh',
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden',
          },
        }}
      >
        {panelContent}
      </Drawer>
    )
  }

  // ── Desktop: right-side slide-in panel ───────────────────────────────────────
  return (
    <Box sx={{
      width: isOpen ? PANEL_WIDTH : 0,
      flexShrink: 0,
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      borderLeft: isOpen ? `1px solid ${theme.palette.divider}` : 'none',
      height: '100%',
    }}>
      {/* Keep the panel mounted but hidden so editor state survives close/open */}
      <Box sx={{ width: PANEL_WIDTH, height: '100%', opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s' }}>
        {panelContent}
      </Box>
    </Box>
  )
}
