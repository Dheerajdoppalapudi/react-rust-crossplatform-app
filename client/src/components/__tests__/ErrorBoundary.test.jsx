import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import ErrorBoundary from '../error/ErrorBoundary'

// Suppress intentional error boundary noise in test output
vi.mock('../../lib/sentry.js', () => ({
  captureException: vi.fn(),
  initSentry:       vi.fn(),
  setUser:          vi.fn(),
}))

const theme = createTheme()

function wrap(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

function Bomb({ shouldThrow = false }) {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>content</div>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    wrap(
      <ErrorBoundary level="component">
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders component-level fallback when child throws', () => {
    wrap(
      <ErrorBoundary level="component">
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders page-level fallback at page level', () => {
    wrap(
      <ErrorBoundary level="page">
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText(/ran into a problem/i)).toBeInTheDocument()
  })

  it('renders a custom static fallback node when provided', () => {
    wrap(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('custom fallback')).toBeInTheDocument()
  })

  it('renders a custom render-prop fallback when provided', () => {
    wrap(
      <ErrorBoundary fallback={({ error }) => <div>caught: {error.message}</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('caught: Test explosion')).toBeInTheDocument()
  })

  it('resets the boundary when the Try again button is clicked', () => {
    // Render with a non-throwing child wrapped in ErrorBoundary.
    // Then programmatically trigger the error state and reset it.
    const onReset = vi.fn()
    wrap(
      <ErrorBoundary level="component" onReset={onReset}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    // Fallback is showing
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    // Click Retry — this calls handleReset which sets hasError=false and calls onReset
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('calls captureException when a child throws', async () => {
    const { captureException } = await import('../../lib/sentry.js')
    wrap(
      <ErrorBoundary level="page">
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorBoundaryLevel: 'page' })
    )
  })
})
