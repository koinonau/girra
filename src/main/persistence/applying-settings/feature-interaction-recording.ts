import type { PersistedState } from '../../../shared/persisted-state-types'
import {
  normalizeFeatureInteractions,
  type FeatureInteractionId
} from '../../../shared/feature-interactions'

export type FeatureInteractionOperations = {
  state: PersistedState
  scheduleSave: () => void
  notifyUIChanged: () => void
  getUI: () => PersistedState['ui']
}

export function recordFeatureInteraction(
  operations: FeatureInteractionOperations,
  id: FeatureInteractionId
): PersistedState['ui'] {
  const featureInteractions = normalizeFeatureInteractions(operations.state.ui?.featureInteractions)
  const existing = featureInteractions[id]

  operations.state.ui = {
    ...operations.state.ui,
    featureInteractions: {
      ...featureInteractions,
      [id]: {
        firstInteractedAt: existing?.firstInteractedAt ?? Date.now(),
        interactionCount: (existing?.interactionCount ?? 0) + 1
      }
    }
  }
  operations.scheduleSave()
  // Why: live UI only consumes the seen transition; a count bump must not re-hydrate the renderer.
  if (!existing) {
    operations.notifyUIChanged()
  }
  return operations.getUI()
}
