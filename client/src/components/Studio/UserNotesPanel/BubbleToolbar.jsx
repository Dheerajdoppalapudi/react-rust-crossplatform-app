import { BubbleMenu } from '@tiptap/react'
import { Box, IconButton, Tooltip, Divider, useTheme } from '@mui/material'
import FormatBoldIcon         from '@mui/icons-material/FormatBold'
import FormatItalicIcon       from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon   from '@mui/icons-material/FormatUnderlined'
import StrikethroughSIcon     from '@mui/icons-material/StrikethroughS'
import CodeIcon               from '@mui/icons-material/Code'
import LinkIcon               from '@mui/icons-material/Link'
import LinkOffIcon            from '@mui/icons-material/LinkOff'

/**
 * Notion-style floating toolbar — appears only when text is selected.
 * Contains inline formatting controls: Bold, Italic, Underline,
 * Strikethrough, Inline Code, Link toggle.
 */
export default function BubbleToolbar({ editor }) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  if (!editor) return null

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run()
  }

  const paperBg  = isDark ? 'rgba(30,30,30,0.97)' : 'rgba(255,255,255,0.98)'
  const border   = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  const shadow   = isDark
    ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'

  const btnSx = (active) => ({
    p: 0.5,
    borderRadius: '5px',
    color: active ? theme.palette.primary.main : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'),
    bgcolor: active ? (isDark ? 'rgba(79,110,255,0.15)' : 'rgba(79,110,255,0.08)') : 'transparent',
    '&:hover': {
      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    transition: 'all 0.12s',
    minWidth: 'unset',
  })

  return (
    <div>
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, placement: 'top', appendTo: 'parent' }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.15,
        bgcolor: paperBg,
        border: `1px solid ${border}`,
        borderRadius: '9px',
        px: 0.6, py: 0.4,
        boxShadow: shadow,
        backdropFilter: 'blur(20px)',
      }}>
        <Tooltip title="Bold (⌘B)" placement="top">
          <IconButton size="small" onClick={() => editor.chain().focus().toggleBold().run()} sx={btnSx(editor.isActive('bold'))}>
            <FormatBoldIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Italic (⌘I)" placement="top">
          <IconButton size="small" onClick={() => editor.chain().focus().toggleItalic().run()} sx={btnSx(editor.isActive('italic'))}>
            <FormatItalicIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Underline (⌘U)" placement="top">
          <IconButton size="small" onClick={() => editor.chain().focus().toggleUnderline().run()} sx={btnSx(editor.isActive('underline'))}>
            <FormatUnderlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Strikethrough" placement="top">
          <IconButton size="small" onClick={() => editor.chain().focus().toggleStrike().run()} sx={btnSx(editor.isActive('strike'))}>
            <StrikethroughSIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Inline code" placement="top">
          <IconButton size="small" onClick={() => editor.chain().focus().toggleCode().run()} sx={btnSx(editor.isActive('code'))}>
            <CodeIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.4, opacity: 0.4 }} />

        <Tooltip title={editor.isActive('link') ? 'Remove link' : 'Add link'} placement="top">
          <IconButton
            size="small"
            onClick={editor.isActive('link') ? () => editor.chain().focus().unsetLink().run() : handleSetLink}
            sx={btnSx(editor.isActive('link'))}
          >
            {editor.isActive('link')
              ? <LinkOffIcon sx={{ fontSize: 15 }} />
              : <LinkIcon    sx={{ fontSize: 15 }} />
            }
          </IconButton>
        </Tooltip>
      </Box>
    </BubbleMenu>
    </div>
  )
}
