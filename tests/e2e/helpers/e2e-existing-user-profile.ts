import { FEATURE_INTERACTION_IDS } from '../../../src/shared/feature-interactions'
import { FEATURE_TIP_IDS } from '../../../src/shared/feature-tips'

const SEEN_FIRST_RUN_FEATURE_INTERACTION_TIMESTAMP = Date.parse('2026-01-01T00:00:00.000Z')

export function getE2EExistingUserProfile() {
  return {
    settings: {},
    ui: {
      // Why: existing-user E2E profiles should not be interrupted by
      // first-run education modals that cover the UI under test.
      featureTipsSeenIds: [...FEATURE_TIP_IDS],
      featureInteractions: Object.fromEntries(
        FEATURE_INTERACTION_IDS.map((id) => [
          id,
          { firstInteractedAt: SEEN_FIRST_RUN_FEATURE_INTERACTION_TIMESTAMP }
        ])
      ),
      projectOrderManualDefaultNoticeDismissed: true,
      // Browser panes render this action in the toolbar. Keep it out of the
      // pointer path for tests that create splits before exercising shortcuts.
      browserImportHintHidden: true,
      // Why: E2E profiles model completed existing users and should not be
      // interrupted by the usage-display change toast covering the UI under test.
      usagePercentageDisplayChangeNoticeDismissed: true
    }
  }
}

/** Older packaged builds still gate first launch on the onboarding wizard. */
export function getE2ELegacyBuildExistingUserProfile() {
  return {
    ...getE2EExistingUserProfile(),
    onboarding: {
      flowVersion: 4,
      closedAt: 1,
      outcome: 'completed',
      lastCompletedStep: 5
    }
  }
}
