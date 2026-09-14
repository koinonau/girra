import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingState } from '../../../../shared/constants'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import type { OnboardingState } from '../../../../shared/onboarding-state-types'
import { getFeatureTipsAppOpenDecision, isCliFeatureTipCompleted } from './feature-tip-startup-gate'

const existingUserOnboarding: OnboardingState = {
  ...getDefaultOnboardingState(),
  closedAt: Date.parse('2026-05-17T00:00:00.000Z'),
  outcome: 'completed',
  lastCompletedStep: 4
}

const firstTimeOnboarding: OnboardingState = getDefaultOnboardingState()

function makeCliStatus(overrides: Partial<CliInstallStatus> = {}): CliInstallStatus {
  return {
    platform: 'darwin',
    commandName: 'orca',
    supported: true,
    state: 'installed',
    commandPath: '/usr/local/bin/orca',
    pathDirectory: '/usr/local/bin',
    pathConfigured: true,
    launcherPath: '/Applications/Orca.app/Contents/MacOS/orca',
    installMethod: 'symlink',
    currentTarget: null,
    unsupportedReason: null,
    detail: null,
    ...overrides
  }
}

describe('feature tip startup gate', () => {
  it('opens the CLI feature tip first for an existing user on app open', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'open', tipId: 'orca-cli' })
  })

  it('suppresses feature tips for first-time users while onboarding is showing', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: firstTimeOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'suppress-for-onboarding' })
  })

  it('does not open later in the same session after onboarding suppressed it', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: true
      })
    ).toEqual({ kind: 'skip' })
  })

  it('opens the command palette tip after the CLI tip was marked seen', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['orca-cli'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'open', tipId: 'cmd-j-palette' })
  })

  it('does not open after every tip was marked seen', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: ['orca-cli', 'cmd-j-palette'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('does not open the CLI tip after the CLI is installed', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['cmd-j-palette'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('waits for CLI install status before opening the CLI tip', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: null,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('does not complete a tip from an unrelated feature interaction', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: [],
        featureInteractions: {
          'cmd-j': { firstInteractedAt: 100, interactionCount: 1 }
        },
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        suppressedByOnboardingThisSession: false
      })
    ).toEqual({ kind: 'open', tipId: 'cmd-j-palette' })
  })

  it('requires an installed CLI to also be configured on PATH', () => {
    expect(isCliFeatureTipCompleted(makeCliStatus())).toBe(true)
    expect(isCliFeatureTipCompleted(makeCliStatus({ pathConfigured: false }))).toBe(false)
  })

  it('treats unsupported CLI setup as completed for feature tips', () => {
    expect(
      isCliFeatureTipCompleted(
        makeCliStatus({
          supported: false,
          state: 'unsupported',
          pathConfigured: false
        })
      )
    ).toBe(true)
  })
})
