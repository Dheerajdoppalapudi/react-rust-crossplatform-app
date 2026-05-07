import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material'
import { createRef } from 'react'
import PromptBar from '../Studio/PromptBar'
import { MODELS, RENDER_MODES } from '../Studio/constants'

vi.mock('../../lib/sentry.js', () => ({
  captureException: vi.fn(),
  initSentry:       vi.fn(),
  setUser:          vi.fn(),
}))

const theme        = createTheme()
const defaultModel = MODELS[0]        // Auto
const autoMode     = RENDER_MODES[0]  // Auto

function makeProps(overrides = {}) {
  return {
    prompt:              '',
    onPromptChange:      vi.fn(),
    onSubmit:            vi.fn(),
    onStop:              vi.fn(),
    onKeyDown:           vi.fn(),
    inputRef:            createRef(),
    isGenerating:        false,
    activeConversation:  null,
    onNewConversation:   vi.fn(),
    pauseContext:        null,
    onClearPauseContext: vi.fn(),
    selectedModel:       defaultModel,
    onModelChange:       vi.fn(),
    selectedRenderMode:  autoMode,
    onRenderModeChange:  vi.fn(),
    ...overrides,
  }
}

function wrap(props) {
  return render(
    <ThemeProvider theme={theme}>
      <PromptBar {...props} />
    </ThemeProvider>
  )
}

describe('PromptBar', () => {
  it('renders the prompt input', () => {
    wrap(makeProps())
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows stop button when isGenerating is true', () => {
    wrap(makeProps({ isGenerating: true }))
    expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument()
  })

  it('send button is disabled when prompt is empty', () => {
    wrap(makeProps({ prompt: '' }))
    const btn = screen.getByRole('button', { name: /send message/i })
    expect(btn).toBeDisabled()
  })

  it('send button is enabled when prompt has text', () => {
    wrap(makeProps({ prompt: 'hello world' }))
    const btn = screen.getByRole('button', { name: /send message/i })
    expect(btn).toBeEnabled()
  })

  it('calls onStop when stop button is clicked', async () => {
    const onStop = vi.fn()
    const user = userEvent.setup()
    wrap(makeProps({ isGenerating: true, onStop }))
    await user.click(screen.getByRole('button', { name: /stop generation/i }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('calls onSubmit when send button is clicked', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    wrap(makeProps({ prompt: 'test prompt', onSubmit }))
    await user.click(screen.getByRole('button', { name: /send message/i }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('calls onKeyDown when a key is pressed in the textarea', async () => {
    const onKeyDown = vi.fn()
    wrap(makeProps({ onKeyDown }))
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalled()
  })

  it('shows pause context chip when pauseContext is provided', () => {
    wrap(makeProps({
      pauseContext: { sessionId: 's1', frameIndex: 2, caption: 'DNA replication' },
    }))
    expect(screen.getByText(/DNA replication/i)).toBeInTheDocument()
  })

  it('calls onClearPauseContext when pause chip close is clicked', async () => {
    const onClearPauseContext = vi.fn()
    const user = userEvent.setup()
    wrap(makeProps({
      pauseContext:        { sessionId: 's1', frameIndex: 2, caption: 'Frame caption' },
      onClearPauseContext,
    }))
    const closeBtn = screen.getByRole('button', { name: /clear pause context/i })
    await user.click(closeBtn)
    expect(onClearPauseContext).toHaveBeenCalledOnce()
  })
})
