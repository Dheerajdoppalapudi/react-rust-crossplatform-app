import { Box, Typography, useTheme } from '@mui/material'
import PromptBar      from './PromptBar'
import SuggestionBoxes from './SuggestionBoxes'

export default function EmptyView({
  onSuggestionClick,
  // PromptBar props — forwarded directly
  prompt,
  onPromptChange,
  onSubmit,
  onStop,
  onKeyDown,
  inputRef,
  isGenerating,
  activeConversation,
  onNewConversation,
  pauseContext,
  onClearPauseContext,
  selectedModel,
  onModelChange,
  selectedRenderMode,
  onRenderModeChange,
  selectedMode,
  onModeChange,
  stagedFiles,
  onAddFiles,
  onRemoveFile,
}) {
  const theme  = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      px:             { xs: 2, sm: 4 },
      py:             6,
      minHeight:      0,
    }}>

      {/* Title */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography sx={{
          fontSize:   { xs: 26, sm: 32 },
          fontWeight: 600,
          lineHeight: 1.2,
          color:      theme.palette.text.primary,
          letterSpacing: -0.5,
        }}>
          What do you want to learn?
        </Typography>
        <Typography sx={{
          mt:         1,
          fontSize:   14,
          color:      isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
          lineHeight: 1.5,
        }}>
          Type a topic and Zenith generates a visual lesson.
        </Typography>
      </Box>

      {/* Prompt bar — centered, embedded so its card aligns with suggestion grid */}
      <Box sx={{ width: '100%', maxWidth: 680, mb: 4 }}>
        <PromptBar
          embedded
          prompt={prompt}
          onPromptChange={onPromptChange}
          onSubmit={onSubmit}
          onStop={onStop}
          onKeyDown={onKeyDown}
          inputRef={inputRef}
          isGenerating={isGenerating}
          activeConversation={activeConversation}
          onNewConversation={onNewConversation}
          pauseContext={pauseContext}
          onClearPauseContext={onClearPauseContext}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          selectedRenderMode={selectedRenderMode}
          onRenderModeChange={onRenderModeChange}
          selectedMode={selectedMode}
          onModeChange={onModeChange}
          stagedFiles={stagedFiles}
          onAddFiles={onAddFiles}
          onRemoveFile={onRemoveFile}
        />
      </Box>

      {/* Suggestions */}
      <Box sx={{ width: '100%', maxWidth: 680 }}>
        <SuggestionBoxes onSuggestionClick={onSuggestionClick} />
      </Box>

    </Box>
  )
}
