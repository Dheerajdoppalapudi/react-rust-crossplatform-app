// Shared SSE stage helpers and reducers — used by useGeneration and useVideoStream.
// Pure functions only; no React imports, no side effects.

// Build the unique stage ID. When the backend sends round > 0 (deep-research
// iterative search), each round gets its own row: searching_r1, searching_r2, …
// All other stages keep their plain ID so existing behaviour is unchanged.
function stageId(event) {
  return (event.round && event.round > 0)
    ? `${event.stage}_r${event.round}`
    : event.stage
}

export function applyStage(stages, event) {
  const id    = stageId(event)
  const extra = {
    ...(event.queries     ? { queries:     event.queries }     : {}),
    ...(event.entity_type ? { entity_type: event.entity_type } : {}),
    // Store the canonical base stage name and round for downstream use.
    baseId: event.stage,
    ...(event.round ? { round: event.round } : {}),
  }

  const exists = stages.find(s => s.id === id)
  return exists
    ? stages.map(s => s.id === id
        ? { ...s, status: 'active', label: event.label ?? s.label, ...extra }
        : s)
    : [...stages, { id, label: event.label ?? event.stage, status: 'active', ...extra }]
}

export function applyStageDone(stages, event) {
  // 1. Exact ID match (covers non-round stages and any future round-aware done events).
  const exact = stages.find(s => s.id === event.stage)
  if (exact) {
    return stages.map(s =>
      s.id === event.stage
        ? { ...s, status: 'done', duration_s: event.duration_s }
        : s
    )
  }

  // 2. Round-based fallback: the backend sends stage_done with stage:'searching'
  //    (no round field). Find the last currently-active stage whose baseId matches
  //    so we mark the right round as done without touching earlier completed ones.
  const lastActive = [...stages].reverse().find(
    s => s.baseId === event.stage && s.status === 'active'
  )
  if (lastActive) {
    return stages.map(s =>
      s.id === lastActive.id
        ? { ...s, status: 'done', duration_s: event.duration_s }
        : s
    )
  }

  return stages
}

// Marks every still-active stage as done — called defensively on stream close.
export function finalizeAllStages(stages) {
  return stages.map(s => s.status === 'active' ? { ...s, status: 'done' } : s)
}

// Pure reducers: (turnState, event) → newTurnState
export const SSE_REDUCERS = {
  stage:      (s, e) => ({ ...s, stages: applyStage(s.stages ?? [], e) }),
  stage_done: (s, e) => ({ ...s, stages: applyStageDone(s.stages ?? [], e) }),

  // Tag each source with the ID of whichever searching stage is currently active
  // so LoadingStageRow can show per-round sources under the correct row.
  source: (s, e) => {
    const activeSearch = [...(s.stages ?? [])].reverse().find(
      st => st.status === 'active' && (st.id === 'searching' || st.baseId === 'searching')
    )
    const tagged = { ...e.source, _roundId: activeSearch?.id ?? 'searching' }
    return { ...s, sources: [...(s.sources ?? []), tagged] }
  },

  token:             (s, e) => ({ ...s, synthesisText:    (s.synthesisText ?? '') + e.text }),
  synthesis_done:    (s)    => ({ ...s, synthesisComplete: true }),
  beats_planned:     (s, e) => ({ ...s, beatTitles: e.beat_titles ?? [], completedBeats: [] }),
  beat_ready:        (s, e) => ({
    ...s,
    completedBeats: s.completedBeats?.includes(e.beat_index)
      ? s.completedBeats
      : [...(s.completedBeats ?? []), e.beat_index],
  }),
  block:             (s, e) => ({ ...s, blocks:           [...(s.blocks ?? []), e.block] }),
  entities_selected: (s, e) => ({ ...s, selectedEntities: e.entities ?? [] }),
  blocks_planned:    (s, e) => ({ ...s, blockCount: e.count ?? 0 }),
}
