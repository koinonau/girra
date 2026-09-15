import { describe, expect, it } from 'vitest'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import { getFeatureTipsAppOpenDecision, isCliFeatureTipCompleted } from './feature-tip-startup-gate'

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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
      })
    ).toEqual({ kind: 'open', tipId: 'orca-cli' })
  })

  it('does not open a second tip in the same session', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: true,
        suppressedForFirstRunThisSession: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('suppresses tips for the session when a first-run profile has no projects', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: false,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
      })
    ).toEqual({ kind: 'suppress-for-first-run' })
  })

  it('does not open after first-run suppression even once a project exists', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: true
      })
    ).toEqual({ kind: 'skip' })
  })

  it('waits for the workspace session before judging first run', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        persistedUIReady: true,
        workspaceSessionReady: false,
        hasProjects: false,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
        persistedUIReady: true,
        workspaceSessionReady: true,
        hasProjects: true,
        promptedThisSession: false,
        suppressedForFirstRunThisSession: false
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
