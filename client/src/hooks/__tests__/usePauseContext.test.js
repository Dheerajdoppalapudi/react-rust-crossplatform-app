import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createRef } from 'react'
import { usePauseContext } from '../usePauseContext'

function makeTurn(overrides = {}) {
  return {
    id:          'sess-1',
    tempId:      'tmp-1',
    prompt:      'test',
    frame_count: 4,
    framesData:  { captions: ['A', 'B', 'C', 'D'], images: [] },
    ...overrides,
  }
}

function setup(turns = [makeTurn()]) {
  const setPrompt   = vi.fn()
  const setViewMode = vi.fn()
  const inputRef    = { current: { focus: vi.fn() } }

  const { result, rerender } = renderHook(
    (props) => usePauseContext(props),
    { initialProps: { turns, setPrompt, setViewMode, inputRef } }
  )
  return { result, rerender, setPrompt, setViewMode, inputRef }
}

describe('usePauseContext', () => {
  it('initialises with null pauseContext', () => {
    const { result } = setup()
    expect(result.current.pauseContext).toBeNull()
  })

  it('sets pauseContext from direct frameIndex + caption', () => {
    const { result } = setup()
    act(() => {
      result.current.handlePauseAsk({
        sessionId:   'sess-1',
        frameIndex:  2,
        caption:     'Direct caption',
      })
    })
    expect(result.current.pauseContext).toEqual({
      sessionId:  'sess-1',
      frameIndex: 2,
      caption:    'Direct caption',
    })
  })

  it('derives frameIndex from currentTime/duration when not provided directly', () => {
    const { result } = setup()
    act(() => {
      result.current.handlePauseAsk({
        sessionId:   'sess-1',
        currentTime: 3,
        duration:    4,
        // 3/4 * 4 frames = 3 → frameIndex 3
      })
    })
    expect(result.current.pauseContext?.frameIndex).toBe(3)
  })

  it('looks up the caption from framesData when not provided directly', () => {
    const { result } = setup()
    act(() => {
      result.current.handlePauseAsk({
        sessionId:   'sess-1',
        currentTime: 0,
        duration:    4,
        // frame 0 → caption 'A'
      })
    })
    expect(result.current.pauseContext?.caption).toBe('A')
  })

  it('does nothing when sessionId does not match any turn', () => {
    const { result } = setup()
    act(() => {
      result.current.handlePauseAsk({ sessionId: 'no-such-session' })
    })
    expect(result.current.pauseContext).toBeNull()
  })

  it('focuses the input after handlePauseAsk', () => {
    const { result, inputRef } = setup()
    act(() => {
      result.current.handlePauseAsk({ sessionId: 'sess-1', frameIndex: 0, caption: 'X' })
    })
    expect(inputRef.current.focus).toHaveBeenCalled()
  })

  it('setPauseContext can clear the context', () => {
    const { result } = setup()
    act(() => {
      result.current.handlePauseAsk({ sessionId: 'sess-1', frameIndex: 0, caption: 'X' })
    })
    act(() => {
      result.current.setPauseContext(null)
    })
    expect(result.current.pauseContext).toBeNull()
  })

  it('handleLearnAsk sets context, updates prompt, and switches to chat view', () => {
    const { result, setPrompt, setViewMode } = setup()
    act(() => {
      result.current.handleLearnAsk({
        question:   'What is entropy?',
        sessionId:  'sess-1',
        frameIndex: 1,
        caption:    'Thermodynamics',
      })
    })
    expect(setPrompt).toHaveBeenCalledWith('What is entropy?')
    expect(setViewMode).toHaveBeenCalledWith('chat')
    expect(result.current.pauseContext).toEqual({
      sessionId:  'sess-1',
      frameIndex: 1,
      caption:    'Thermodynamics',
    })
  })
})
