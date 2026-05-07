import { z } from 'zod'

// ─── Primitives ───────────────────────────────────────────────────────────────

const VideoPhase = z.enum(['generating', 'ready', 'error', 'disabled'])

const FramesDataSchema = z.object({
  sessionId: z.string().optional(),
  captions:  z.array(z.string()).default([]),
  images:    z.array(z.string()).default([]),
  notes:     z.string().optional(),
  frame_count: z.number().optional(),
}).nullable().optional()

// ─── Turn ─────────────────────────────────────────────────────────────────────

export const TurnSchema = z.object({
  id:               z.string(),
  tempId:           z.string().optional(),
  prompt:           z.string(),
  videoPhase:       VideoPhase.optional(),
  render_path:      z.string().optional(),
  title:            z.string().optional(),
  learningObjective: z.string().optional(),
  blocks:           z.array(z.object({
    id:          z.string(),
    type:        z.string(),
    entity_type: z.string().optional(),
    content:     z.string().optional(),
    props:       z.record(z.unknown()).optional(),
    html:        z.string().nullable().optional(),
  })).optional(),
  framesData: FramesDataSchema,
})

// ─── Conversation ─────────────────────────────────────────────────────────────

export const ConversationSchema = z.object({
  id:     z.string(),
  title:  z.string(),
  turns:  z.array(TurnSchema).default([]),
})

export const ConversationSummarySchema = z.object({
  id:      z.string(),
  title:   z.string(),
  starred: z.number().optional(),
})

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Safely parse an API response against a schema.
 * Returns `{ data, error }` — never throws.
 * On failure, logs to console in dev and calls captureException in production.
 *
 * @template T
 * @param {z.ZodType<T>} schema
 * @param {unknown}      raw
 * @returns {{ data: T | null, error: z.ZodError | null }}
 */
export function safeParse(schema, raw) {
  const result = schema.safeParse(raw)
  if (result.success) return { data: result.data, error: null }

  if (import.meta.env.DEV) {
    console.warn('[schema] validation failed', result.error.issues)
  } else {
    import('../lib/sentry.js').then(({ captureException }) =>
      captureException(new Error('Schema validation failed'), {
        issues: result.error.issues,
      })
    )
  }

  return { data: null, error: result.error }
}
