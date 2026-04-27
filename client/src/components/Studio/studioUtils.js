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
    textMode:         !videoEnabled,
    framesData:       null,
    videoPhase:       videoEnabled ? 'generating' : 'disabled',
    parentSessionId,
    parentFrameIndex,
  }
}
