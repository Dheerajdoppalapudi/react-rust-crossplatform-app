export function parseNotes(raw) {
  return (raw || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
}

export function isTextTurn(turn) {
  return turn.framesData?.render_path === 'text' || turn.render_path === 'text'
}

export function formatIntentType(intentType) {
  return (intentType || '').replace(/_/g, ' ')
}

export function getFrameCount(turn) {
  return turn.framesData?.captions?.length || turn.frame_count || 0
}

export function normalizeFramesData(data) {
  return {
    render_path:         data.render_path,
    images:              data.images              || [],
    captions:            data.captions            || [],
    suggested_followups: data.suggested_followups || [],
    notes:               data.notes               || '',
  }
}

// Converts old scene_ir.json format ({ explanation, entities }) to the new blocks[] format.
// Needed for sessions saved before the blocks IR was introduced.
export function migrateOldSceneIR(raw) {
  const blocks = []
  if (raw.explanation) {
    blocks.push({ id: 'b0', type: 'text', content: raw.explanation })
  }
  for (const entity of raw.entities ?? []) {
    blocks.push({
      id:          entity.id,
      type:        'entity',
      entity_type: entity.type,
      props:       entity.props ?? {},
      html:        entity.html  ?? null,
    })
  }
  return blocks
}

export function createTempTurn({ tempId, prompt, videoEnabled, parentSessionId, parentFrameIndex = null }) {
  return {
    tempId,
    id:               null,
    prompt,
    intent_type:      null,
    render_path:      null,
    frame_count:      null,
    isLoading:        true,
    stage:            'planning',
    framesData:       null,
    // videoPhase 'disabled' signals text/interactive mode — derive textMode from
    // this at render time instead of storing a redundant dead field on every turn.
    videoPhase:       videoEnabled ? 'generating' : 'disabled',
    parentSessionId,
    parentFrameIndex,
  }
}
