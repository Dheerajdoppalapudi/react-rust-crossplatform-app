/**
 * Returns the label of the currently active stage from `turn.stages` array.
 * Falls back to 'Processing…' when stages haven't arrived yet.
 */
export function getActiveStageLabel(turn) {
  if (turn.stages?.length) {
    return turn.stages.find((s) => s.status === 'active')?.label ?? 'Processing…'
  }
  return 'Processing…'
}
