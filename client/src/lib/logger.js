/**
 * Structured logger — replaces raw console.error / console.log calls.
 *
 * In development:  prints to console with a [LEVEL] prefix so you can filter.
 * In production:   console output is suppressed; errors are forwarded to Sentry.
 *
 * Usage:
 *   import { logger } from '@lib/logger'
 *   logger.error('generation_failed', err, { sessionId })
 *   logger.warn('media_token_cache_miss', { sessionId })
 *   logger.info('generation_started', { prompt: prompt.slice(0, 80) })
 */

import { captureException } from './sentry'

const IS_DEV = import.meta.env.DEV

export const logger = {
  info(msg, ctx) {
    if (IS_DEV) console.info(`[INFO] ${msg}`, ctx ?? '')
  },

  warn(msg, ctx) {
    if (IS_DEV) console.warn(`[WARN] ${msg}`, ctx ?? '')
    // Warnings are not sent to Sentry — too noisy. Promote to error if action needed.
  },

  error(msg, err, ctx) {
    if (IS_DEV) console.error(`[ERR] ${msg}`, err, ctx ?? '')
    captureException(err instanceof Error ? err : new Error(String(err)), {
      msg,
      ...ctx,
    })
  },
}
