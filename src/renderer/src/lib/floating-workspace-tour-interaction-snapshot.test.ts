import { describe, expect, it, vi } from 'vitest'
import { createFloatingWorkspaceTourInteractionSnapshot } from './floating-workspace-tour-interaction-snapshot'

describe('createFloatingWorkspaceTourInteractionSnapshot', () => {
  it('records the floating workspace interaction on open', () => {
    const persisted = Promise.resolve()
    const recordFeatureInteraction = vi.fn(() => persisted)

    const snapshot = createFloatingWorkspaceTourInteractionSnapshot({
      persistedUIReady: true,
      recordFeatureInteraction
    })

    expect(recordFeatureInteraction).toHaveBeenCalledOnce()
    expect(recordFeatureInteraction).toHaveBeenCalledWith('floating-workspace')
    expect(snapshot.persisted).toBe(persisted)
    expect(snapshot.recordFeatureInteractionForTour).toBe(false)
  })

  it('defers recording to the tour hook when opened before persisted UI is ready', () => {
    const recordFeatureInteraction = vi.fn(() => Promise.resolve())

    const snapshot = createFloatingWorkspaceTourInteractionSnapshot({
      persistedUIReady: false,
      recordFeatureInteraction
    })

    expect(recordFeatureInteraction).not.toHaveBeenCalled()
    expect(snapshot.persisted).toBeUndefined()
    expect(snapshot.recordFeatureInteractionForTour).toBe(true)
  })
})
