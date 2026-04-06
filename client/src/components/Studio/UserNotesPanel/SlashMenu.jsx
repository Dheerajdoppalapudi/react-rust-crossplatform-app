import { useState, useEffect, useRef } from 'react'
import { FloatingMenu } from '@tiptap/react'
import { Box, Typography, useTheme } from '@mui/material'
import NotesIcon            from '@mui/icons-material/Notes'
import LooksOneIcon         from '@mui/icons-material/LooksOne'
import LooksTwoIcon         from '@mui/icons-material/LooksTwo'
import Looks3Icon           from '@mui/icons-material/Looks3'
import FormatListBulletedIcon  from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon  from '@mui/icons-material/FormatListNumbered'
import CheckBoxOutlinedIcon    from '@mui/icons-material/CheckBoxOutlined'
import CodeIcon                from '@mui/icons-material/Code'
import FormatQuoteIcon         from '@mui/icons-material/FormatQuote'

const COMMANDS = [
  {
    label: 'Text',
    description: 'Plain paragraph',
    icon: <NotesIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    label: 'Heading 1',
    description: 'Large section title',
    icon: <LooksOneIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    description: 'Medium section title',
    icon: <LooksTwoIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    description: 'Small section title',
    icon: <Looks3Icon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Bullet list',
    description: 'Unordered list',
    icon: <FormatListBulletedIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    description: 'Ordered list',
    icon: <FormatListNumberedIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Task list',
    description: 'Checklist with checkboxes',
    icon: <CheckBoxOutlinedIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    label: 'Code block',
    description: 'Monospaced code',
    icon: <CodeIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: 'Quote',
    description: 'Block quotation',
    icon: <FormatQuoteIcon sx={{ fontSize: 15 }} />,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
]

/**
 * Notion-style "/" command palette.
 * Appears when the cursor is at the start of an empty line and the user
 * types "/". Keyboard navigable: ↑↓ to move, Enter to select, Esc to close.
 */
export default function SlashMenu({ editor }) {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const [selected, setSelected] = useState(0)
  const listRef = useRef(null)

  // Reset selection when menu opens
  useEffect(() => { setSelected(0) }, [])

  const runCommand = (index) => {
    // Delete the "/" trigger character then run the command
    editor.chain().focus().deleteRange({
      from: editor.state.selection.$from.start(),
      to:   editor.state.selection.from,
    }).run()
    COMMANDS[index].action(editor)
  }

  // Keyboard handler — attached to the editor's DOM element
  useEffect(() => {
    if (!editor) return
    const handleKey = (e) => {
      // Only intercept when the FloatingMenu is showing — inferred by checking
      // if the current node is empty (same condition FloatingMenu uses)
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((p) => (p + 1) % COMMANDS.length) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((p) => (p - 1 + COMMANDS.length) % COMMANDS.length) }
      if (e.key === 'Enter') {
        // Only intercept if the menu is supposed to be visible
        const { $from } = editor.state.selection
        const isEmptyLine = $from.parent.textContent === '' || $from.parent.textContent === '/'
        if (!isEmptyLine) return
        e.preventDefault()
        runCommand(selected)
      }
      if (e.key === 'Escape') {
        editor.chain().focus().run()
      }
    }
    const el = editor.view.dom
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, selected])

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[selected]
    item?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!editor) return null

  const paperBg = isDark ? 'rgba(28,28,28,0.97)' : 'rgba(255,255,255,0.98)'
  const border  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'
  const shadow  = isDark
    ? '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)'
    : '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)'

  return (
    <div>
    <FloatingMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: 'bottom-start', offset: [0, 4], appendTo: 'parent' }}
      shouldShow={({ state }) => {
        const { $from } = state.selection
        const text = $from.parent.textContent
        return text === '/'
      }}
    >
      <Box
        ref={listRef}
        sx={{
          bgcolor: paperBg,
          border: `1px solid ${border}`,
          borderRadius: '10px',
          boxShadow: shadow,
          backdropFilter: 'blur(20px)',
          py: 0.5,
          width: 240,
          maxHeight: 320,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: theme.palette.divider, borderRadius: 2 },
        }}
      >
        <Typography sx={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'text.disabled', px: 1.5, pt: 0.5, pb: 0.25, textTransform: 'uppercase',
        }}>
          Insert
        </Typography>

        {COMMANDS.map((cmd, i) => {
          const isActive = i === selected
          return (
            <Box
              key={cmd.label}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => { e.preventDefault(); runCommand(i) }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                px: 1.5, py: 0.6,
                cursor: 'pointer',
                bgcolor: isActive
                  ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)')
                  : 'transparent',
                borderRadius: '6px', mx: 0.5,
                transition: 'background 0.1s',
              }}
            >
              <Box sx={{
                width: 28, height: 28, borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                color: isActive ? theme.palette.primary.main : 'text.secondary',
                flexShrink: 0,
                transition: 'color 0.1s',
              }}>
                {cmd.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}>
                  {cmd.label}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.2 }}>
                  {cmd.description}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </FloatingMenu>
    </div>
  )
}
