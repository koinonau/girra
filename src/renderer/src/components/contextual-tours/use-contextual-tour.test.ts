import { describe, expect, it, vi } from 'vitest'
import {
  createContextualTourInteractionSnapshot,
  shouldRequestContextualTourAfterInteraction
} from './use-contextual-tour'
import type { ContextualTourId } from '../../../../shared/contextual-tours'

describe('shouldRequestContextualTourAfterInteraction', () => {
  it('waits for persisted seen ids before allowing a tour request', async () => {
    let resolvePersisted!: () => void
    const persisted = new Promise<void>((resolve) => {
      resolvePersisted = resolve
    })
    const seenIds: ContextualTourId[] = []
    const requestReady = shouldRequestContextualTourAfterInteraction({
      id: 'tasks',
      persisted,
      isCancelled: () => false,
      getContextualToursSeenIds: () => seenIds
    })

    let settled = false
    void requestReady.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    seenIds.push('tasks')
    resolvePersisted()

    await expect(requestReady).resolves.toBe(false)
  })

  it('allows the request when the tour remains unseen after persistence settles', async () => {
    await expect(
      shouldRequestContextualTourAfterInteraction({
        id: 'tasks',
        persisted: Promise.resolve(),
        isCancelled: () => false,
        getContextualToursSeenIds: () => []
      })
    ).resolves.toBe(true)
  })
})

describe('createContextualTourInteractionSnapshot', () => {
  it('records regular contextual-tour feature interactions before requesting', async () => {
    const persisted = Promise.resolve()
    const recordFeatureInteraction = vi.fn(() => persisted)

    const snapshot = createContextualTourInteractionSnapshot({
      id: 'tasks',
      recordFeatureInteraction,
      recordFeatureInteractionForTour: true
    })

    expect(recordFeatureInteraction).toHaveBeenCalledWith('tasks')
    await expect(snapshot.persisted).resolves.toBeUndefined()
  })

  it('reuses the floating workspace pre-open snapshot without double-recording', async () => {
    const persisted = Promise.resolve()
    const recordFeatureInteraction = vi.fn(() => Promise.resolve())

    const snapshot = createContextualTourInteractionSnapshot({
      id: 'floating-workspace',
      recordFeatureInteraction,
      recordFeatureInteractionForTour: false,
      featureInteractionPersisted: persisted
    })

    expect(recordFeatureInteraction).not.toHaveBeenCalled()
    expect(snapshot.persisted).toBe(persisted)
  })
})
