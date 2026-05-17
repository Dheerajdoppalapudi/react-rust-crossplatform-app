import { createContext, useContext } from 'react'
import { create } from 'zustand'

/**
 * Turn-scoped context — BlockRenderer provides this so every entity inside it
 * knows which turn it belongs to without prop drilling.
 * useSceneStore reads this to namespace step state per-turn.
 */
export const TurnIdContext = createContext(null)
export const useTurnId = () => useContext(TurnIdContext)

/**
 * Scene-level step state, scoped per turn.
 *
 * Keys are (turnId, entityId) pairs so multiple turns can each have
 * independent entity state simultaneously. Calling clearTurn() on unmount
 * releases memory for that turn without touching other turns.
 *
 * step_controls writes: setStep(turnId, targetEntityId, step)
 * Consumers read:       getStep(turnId, entityId)
 * BlockRenderer calls:  clearTurn(turnId) on unmount
 */
export const useSceneStore = create((set, get) => ({
  stepsByTurn: {},  // { [turnId]: { [entityId]: number } }

  setStep: (turnId, entityId, step) => {
    if (!turnId || !entityId) return
    set(state => {
      const turnSlice = state.stepsByTurn[turnId] ?? {}
      const current   = turnSlice[entityId] ?? 0
      const resolved  = typeof step === 'function' ? step(current) : step
      return {
        stepsByTurn: {
          ...state.stepsByTurn,
          [turnId]: { ...turnSlice, [entityId]: resolved },
        },
      }
    })
  },

  getStep: (turnId, entityId) =>
    get().stepsByTurn[turnId]?.[entityId] ?? 0,

  clearTurn: (turnId) => {
    if (!turnId) return
    set(state => {
      if (!state.stepsByTurn[turnId]) return state
      const next = { ...state.stepsByTurn }
      delete next[turnId]
      return { stepsByTurn: next }
    })
  },
}))
