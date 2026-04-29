import { create } from 'zustand'

/**
 * Scene-level step state shared across entities.
 *
 * Entities read/write via entityId key so each widget has independent state.
 *
 * step_controls writes: setStep(targetEntityId, step)
 * code_walkthrough reads: getStep(entityId)
 * SceneRenderer calls: resetScene() on mount to clear stale state from prior turns.
 */
export const useSceneStore = create((set, get) => ({
  stepsByEntityId: {},

  setStep: (entityId, step) =>
    set(state => ({
      stepsByEntityId: { ...state.stepsByEntityId, [entityId]: step },
    })),

  getStep: (entityId) => get().stepsByEntityId[entityId] ?? 0,

  resetScene: () => set({ stepsByEntityId: {} }),
}))
