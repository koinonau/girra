import { describe, expect, it, vi } from 'vitest'
import { getDefaultUIState } from '../../shared/constants'
import { FEATURE_INTERACTION_IDS } from '../../shared/feature-interactions'
import { FEATURE_TIP_IDS } from '../../shared/feature-tips'
import type { PersistedUIState } from '../../shared/persisted-ui-state-types'
import {
  DEV_SHOW_FIRST_RUN_EDUCATION_ENV,
  shouldSuppressDevEducation,
  suppressDevEducationForStore
} from './dev-education-suppression'

function createStoreState(overrides?: { ui?: Partial<PersistedUIState> }) {
  let ui: PersistedUIState = {
    ...getDefaultUIState(),
    ...overrides?.ui
  }

  return {
    get ui() {
      return ui
    },
    store: {
      getUI: vi.fn(() => ui),
      updateUI: vi.fn((updates: Partial<PersistedUIState>) => {
        ui = { ...ui, ...updates }
      })
    }
  }
}

describe('shouldSuppressDevEducation', () => {
  it('suppresses first-run education for normal dev launches', () => {
    expect(shouldSuppressDevEducation({ isDev: true, env: {} })).toBe(true)
  })

  it('does not suppress packaged launches', () => {
    expect(shouldSuppressDevEducation({ isDev: false, env: {} })).toBe(false)
  })

  it('respects the first-run education env escape hatch', () => {
    expect(
      shouldSuppressDevEducation({
        isDev: true,
        env: { [DEV_SHOW_FIRST_RUN_EDUCATION_ENV]: '1' }
      })
    ).toBe(false)
  })

  it('does not suppress E2E-controlled profiles', () => {
    expect(
      shouldSuppressDevEducation({
        isDev: true,
        env: { GIRRA_E2E_USER_DATA_DIR: '/tmp/orca-e2e' }
      })
    ).toBe(false)
  })
})

describe('suppressDevEducationForStore', () => {
  it('marks first-run education complete', () => {
    const state = createStoreState()

    suppressDevEducationForStore(state.store, 1234)

    expect(state.ui.featureTipsSeenIds).toEqual(FEATURE_TIP_IDS)
    expect(Object.keys(state.ui.featureInteractions ?? {}).sort()).toEqual(
      [...FEATURE_INTERACTION_IDS].sort()
    )
  })

  it('preserves existing education history', () => {
    const state = createStoreState({
      ui: {
        featureTipsSeenIds: ['cmd-j-palette'],
        featureInteractions: {
          tasks: { firstInteractedAt: 77, interactionCount: 3 }
        }
      }
    })

    suppressDevEducationForStore(state.store, 1234)

    expect(state.ui.featureTipsSeenIds).toEqual(['cmd-j-palette', 'orca-cli'])
    expect(state.ui.featureInteractions?.tasks).toEqual({
      firstInteractedAt: 77,
      interactionCount: 3
    })
  })

  it('does not write UI when education state is already suppressed', () => {
    const featureInteractions = Object.fromEntries(
      FEATURE_INTERACTION_IDS.map((id) => [id, { firstInteractedAt: 1, interactionCount: 1 }])
    )
    const state = createStoreState({
      ui: {
        featureTipsSeenIds: [...FEATURE_TIP_IDS],
        featureInteractions
      }
    })

    suppressDevEducationForStore(state.store, 1234)

    expect(state.store.updateUI).not.toHaveBeenCalled()
  })
})
