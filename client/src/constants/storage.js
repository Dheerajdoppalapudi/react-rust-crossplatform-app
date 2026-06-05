// All localStorage key strings in one place — prevents typo-driven key mismatches.

export const STORAGE_KEYS = {
  THEME:          'paralyte-theme',
  NOTES_ENABLED:  'studio-notes-enabled',
  VIDEO_ENABLED:  'studio-video-enabled',
  CAPTIONS_ON:    'paralyte-captions-on',
  // A prompt typed on the public landing page, carried into Studio after the
  // user signs in. Pre-fills the prompt bar — it is never auto-submitted.
  PENDING_PROMPT: 'paralyte-pending-prompt',
}

export const VALID_THEMES = new Set(['light', 'dark'])
