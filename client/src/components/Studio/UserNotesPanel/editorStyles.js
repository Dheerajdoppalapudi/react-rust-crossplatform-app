/**
 * Returns an MUI `sx` prop object for the TipTap editor wrapper Box.
 * Styles target ProseMirror's output DOM classes so the editor matches
 * the app's dark/light theme without any separate CSS file.
 */
export function getEditorSx(theme) {
  const isDark = theme.palette.mode === 'dark'
  const textPrimary   = theme.palette.text.primary
  const textSecondary = theme.palette.text.secondary
  const divider       = theme.palette.divider
  const primary       = theme.palette.primary.main
  const codeBg        = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const codeBlockBg   = isDark ? 'rgba(0,0,0,0.35)'       : 'rgba(0,0,0,0.04)'
  const blockquoteBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  return {
    flex: 1,
    overflowY: 'auto',
    px: 2.5,
    py: 2,
    '&::-webkit-scrollbar': { width: 3 },
    '&::-webkit-scrollbar-thumb': { backgroundColor: divider, borderRadius: 2 },

    // ProseMirror root
    '& .ProseMirror': {
      outline: 'none',
      minHeight: 200,
      color: textPrimary,
      fontSize: 14,
      lineHeight: 1.7,
      fontFamily: theme.typography.fontFamily,
    },

    // Placeholder
    '& .ProseMirror p.is-editor-empty:first-of-type::before': {
      content: 'attr(data-placeholder)',
      color: textSecondary,
      opacity: 0.5,
      pointerEvents: 'none',
      float: 'left',
      height: 0,
    },

    // Headings
    '& .ProseMirror h1': {
      fontSize: 22, fontWeight: 700, lineHeight: 1.3,
      mt: 0, mb: 0.5, color: textPrimary,
    },
    '& .ProseMirror h2': {
      fontSize: 18, fontWeight: 600, lineHeight: 1.35,
      mt: 0, mb: 0.5, color: textPrimary,
    },
    '& .ProseMirror h3': {
      fontSize: 15, fontWeight: 600, lineHeight: 1.4,
      mt: 0, mb: 0.5, color: textPrimary,
    },

    // Paragraph spacing
    '& .ProseMirror p': {
      mt: 0, mb: '0.5em',
    },

    // Lists
    '& .ProseMirror ul, & .ProseMirror ol': {
      pl: '1.4em', mb: '0.5em',
    },
    '& .ProseMirror li': {
      mb: '0.15em',
    },
    '& .ProseMirror li > p': {
      mb: 0,
    },

    // Task list
    '& .ProseMirror ul[data-type="taskList"]': {
      listStyle: 'none', pl: '0.5em',
    },
    '& .ProseMirror ul[data-type="taskList"] li': {
      display: 'flex', alignItems: 'flex-start', gap: '0.5em',
    },
    '& .ProseMirror ul[data-type="taskList"] li > label': {
      flexShrink: 0, mt: '3px',
    },
    '& .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"]': {
      cursor: 'pointer', accentColor: primary,
    },
    '& .ProseMirror ul[data-type="taskList"] li > div': {
      flex: 1,
    },

    // Inline code
    '& .ProseMirror code': {
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: '0.85em',
      bgcolor: codeBg,
      px: '0.3em', py: '0.1em',
      borderRadius: '3px',
      color: isDark ? '#e2b96f' : '#c56a00',
    },

    // Code block
    '& .ProseMirror pre': {
      bgcolor: codeBlockBg,
      border: `1px solid ${divider}`,
      borderRadius: '8px',
      p: '12px 16px',
      mb: '0.75em',
      overflowX: 'auto',
      '& code': {
        bgcolor: 'transparent', px: 0, py: 0,
        fontSize: 13, color: isDark ? '#a5d6a7' : '#1b5e20',
      },
    },

    // Blockquote
    '& .ProseMirror blockquote': {
      borderLeft: `3px solid ${primary}`,
      bgcolor: blockquoteBg,
      pl: 2, pr: 1, py: 0.5,
      mb: '0.5em', borderRadius: '0 6px 6px 0',
      color: textSecondary,
      fontStyle: 'italic',
    },

    // Links
    '& .ProseMirror a': {
      color: primary,
      textDecoration: 'underline',
      cursor: 'pointer',
      '&:hover': { opacity: 0.8 },
    },

    // Horizontal rule
    '& .ProseMirror hr': {
      border: 'none',
      borderTop: `1px solid ${divider}`,
      my: '1em',
    },

    // Tables
    '& .ProseMirror table': {
      borderCollapse: 'collapse',
      width: '100%',
      mb: '0.75em',
      fontSize: 13,
    },
    '& .ProseMirror th, & .ProseMirror td': {
      border: `1px solid ${divider}`,
      px: 1.5, py: 0.75,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '& .ProseMirror th': {
      fontWeight: 600,
      bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    '& .ProseMirror .selectedCell': {
      bgcolor: isDark ? 'rgba(79,110,255,0.15)' : 'rgba(79,110,255,0.08)',
    },

    // Bold, italic
    '& .ProseMirror strong': { fontWeight: 700 },
    '& .ProseMirror em':     { fontStyle: 'italic' },
    '& .ProseMirror s':      { textDecoration: 'line-through' },
  }
}
