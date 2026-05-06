// Centralized timing constants — all setTimeout/setInterval durations in one place.
// Named constants make intent clear and make global tuning a one-line change.

export const TIMINGS = {
  // Optimistic stage-label delays in useGeneration (non-first turn, video mode)
  STAGE_DELAY_GENERATING_MS:    2_500,
  STAGE_DELAY_RENDERING_MS:     6_000,

  // Loading screen timer-fired label in LoadingView
  INTERACTIVE_PLANNER_DELAY_MS: 1_400,

  // How long after setPauseContext() before the input receives focus
  PAUSE_FOCUS_DELAY_MS:           120,

  // How long 'Copied!' check-mark shows in copy buttons
  COPY_FEEDBACK_DURATION_MS:    2_000,

  // Media token: seconds before expiry to proactively refresh (prevent playback interruption)
  MEDIA_TOKEN_EARLY_REFRESH_MS: 60 * 1_000,

  // Toast auto-hide defaults (ms per severity)
  TOAST_SUCCESS_MS:  4_000,
  TOAST_INFO_MS:     4_000,
  TOAST_WARNING_MS:  5_000,
  TOAST_ERROR_MS:    7_000,

  // UserNotesPanel: debounce before auto-saving, and how long 'Saved' badge shows
  NOTES_DEBOUNCE_MS:    1_500,
  NOTES_SAVED_RESET_MS: 3_000,

  // QuizBlock: delay before advancing to next question or showing summary
  QUIZ_ANSWER_DELAY_MS:  900,
  QUIZ_ADVANCE_DELAY_MS: 800,
  QUIZ_SUMMARY_DELAY_MS: 400,
}
