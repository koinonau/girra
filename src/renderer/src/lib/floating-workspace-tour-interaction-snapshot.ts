export type FloatingWorkspaceTourInteractionSnapshot = {
  persisted?: Promise<void>
  recordFeatureInteractionForTour: boolean
}

export function createFloatingWorkspaceTourInteractionSnapshot(args: {
  persistedUIReady: boolean
  recordFeatureInteraction: (id: 'floating-workspace') => Promise<void>
}): FloatingWorkspaceTourInteractionSnapshot {
  if (!args.persistedUIReady) {
    return {
      recordFeatureInteractionForTour: true
    }
  }
  return {
    persisted: args.recordFeatureInteraction('floating-workspace'),
    recordFeatureInteractionForTour: false
  }
}
