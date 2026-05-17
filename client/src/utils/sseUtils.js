// Shared SSE stage helpers and reducers — used by useGeneration and useVideoStream.
// Pure functions only; no React imports, no side effects.

export function applyStage(stages, event) {
  const exists = stages.find(s => s.id === event.stage)
  const extra  = event.queries ? { queries: event.queries } : {}
  return exists
    ? stages.map(s => s.id === event.stage
        ? { ...s, status: 'active', label: event.label ?? s.label, ...extra }
        : s)
    : [...stages, { id: event.stage, label: event.label ?? event.stage, status: 'active', ...extra }]
}

export function applyStageDone(stages, event) {
  return stages.map(s =>
    s.id === event.stage ? { ...s, status: 'done', duration_s: event.duration_s } : s
  )
}

// Marks every still-active stage as done — called defensively on stream close.
export function finalizeAllStages(stages) {
  return stages.map(s => s.status === 'active' ? { ...s, status: 'done' } : s)
}

// Appends a single query string to the queries list of the 'searching' stage.
function _applySearchQuery(stages, query) {
  return stages.map(s =>
    s.id === 'searching'
      ? { ...s, queries: [...(s.queries ?? []), query] }
      : s
  )
}

// Pure reducers: (turnState, event) → newTurnState
// One entry per SSE event type. Adding a new event = one line here.
export const SSE_REDUCERS = {
  stage:          (s, e) => ({ ...s, stages:           applyStage(s.stages ?? [], e) }),
  stage_done:     (s, e) => ({ ...s, stages:           applyStageDone(s.stages ?? [], e) }),
  source:         (s, e) => ({ ...s, sources:          [...(s.sources ?? []), e.source] }),
  token:          (s, e) => ({ ...s, synthesisText:    (s.synthesisText ?? '') + e.text }),
  synthesis_done: (s, _) => ({ ...s, synthesisComplete: true }),
  beats_planned:  (s, e) => ({ ...s, beatTitles: e.beat_titles ?? [], completedBeats: [] }),
  beat_ready:     (s, e) => ({
    ...s,
    completedBeats: s.completedBeats?.includes(e.beat_index)
      ? s.completedBeats
      : [...(s.completedBeats ?? []), e.beat_index],
  }),
  beat_status:    (s, e) => ({ ...s, beatStatuses: { ...(s.beatStatuses ?? {}), [e.beat_index]: e.action } }),
  block:          (s, e) => ({ ...s, blocks:           [...(s.blocks ?? []), e.block] }),
  search_query:   (s, e) => ({ ...s, stages: _applySearchQuery(s.stages ?? [], e.query) }),
}
