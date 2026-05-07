import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'
import { cleanup } from '@testing-library/react'

// Start MSW before all tests, reset handlers after each, stop after all.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => { server.resetHandlers(); cleanup() })
afterAll(() => server.close())

// Silence Sentry in tests — the lib/sentry module checks import.meta.env.DEV
// which vitest sets to true, so captureException is already a no-op.
// This suppresses console.error noise from intentional error throws in tests.
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    const msg = args[0]?.toString?.() ?? ''
    // Suppress React act() warnings and PropTypes noise in test output
    if (msg.includes('act(') || msg.includes('PropTypes')) return
    originalError(...args)
  }
})
afterAll(() => { console.error = originalError })
