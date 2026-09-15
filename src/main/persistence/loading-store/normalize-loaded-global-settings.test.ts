import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/constants'
import { normalizeLoadedGlobalSettings } from './normalize-loaded-global-settings'
import { prepareLoadedTerminalSettings } from './prepare-loaded-terminal-settings'
import { prepareLoadedProfileSettings } from './prepare-loaded-profile-settings'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { PersistedState } from '../../../shared/persisted-state-types'

// Simulates a profile created before the dedicated Experimental switch was persisted.
function normalizeLegacyProfile(overrides: Record<string, unknown>): PersistedState['settings'] {
  const defaults = getDefaultPersistedState(homedir())
  const settings: Partial<GlobalSettings> = { ...defaults.settings }
  delete settings.experimentalActivity
  delete settings.experimentalAgentDashboardPopout
  Object.assign(settings, overrides)
  const parsed: PersistedState = { ...defaults, settings: settings as GlobalSettings }
  const noop = (): void => {}
  const terminal = prepareLoadedTerminalSettings(parsed, noop)
  const profile = prepareLoadedProfileSettings(parsed, defaults, noop)
  return normalizeLoadedGlobalSettings(parsed, terminal, profile)
}

describe('retired Agents sidebar setting', () => {
  it('does not mark new profiles as migrated', () => {
    expect(normalizeLegacyProfile({}).agentsSidebarMigratedFromExperimental).toBe(false)
  })

  it('drops the old visibility setting while preserving migration metadata', () => {
    const normalized = normalizeLegacyProfile({
      experimentalActivity: true,
      showAgentsSidebar: false
    })
    expect('showAgentsSidebar' in normalized).toBe(false)
    expect(normalized.agentsSidebarMigratedFromExperimental).toBe(true)
  })
})

describe('retired Codex account settings', () => {
  it('drops the Codex account keys so they stop round-tripping', () => {
    const normalized = normalizeLegacyProfile({
      codexManagedAccounts: [{ id: 'account-1', managedHomePath: '/data/codex-accounts/a/home' }],
      activeCodexManagedAccountId: 'account-1',
      activeCodexManagedAccountIdsByRuntime: { host: 'account-1', wsl: {} },
      skipCodexRateLimitResetConfirm: true,
      codexSessionSourceHome: { host: '/custom/codex' }
    })
    for (const key of [
      'codexManagedAccounts',
      'activeCodexManagedAccountId',
      'activeCodexManagedAccountIdsByRuntime',
      'skipCodexRateLimitResetConfirm',
      'codexSessionSourceHome'
    ]) {
      expect(key in normalized).toBe(false)
    }
  })
})

describe('retired mobile pairing address settings', () => {
  it('drops the custom address keys so they stop round-tripping', () => {
    const normalized = normalizeLegacyProfile({
      mobilePairingCustomAddress: '100.64.1.20:6768',
      mobilePairingCustomAddresses: ['100.64.1.20:6768']
    })
    expect('mobilePairingCustomAddress' in normalized).toBe(false)
    expect('mobilePairingCustomAddresses' in normalized).toBe(false)
  })
})

describe('retired agent ids', () => {
  function normalizeWithSaveFlag(overrides: Record<string, unknown>) {
    const defaults = getDefaultPersistedState(homedir())
    const parsed = {
      ...defaults,
      settings: { ...defaults.settings, ...overrides } as GlobalSettings
    } as PersistedState
    let needsSave = false
    const markNeedsSave = (): void => {
      needsSave = true
    }
    const terminal = prepareLoadedTerminalSettings(parsed, markNeedsSave)
    const profile = prepareLoadedProfileSettings(parsed, defaults, markNeedsSave)
    return { settings: normalizeLoadedGlobalSettings(parsed, terminal, profile), needsSave }
  }

  it('resets a retired default agent to auto-pick and marks the profile for save', () => {
    const result = normalizeWithSaveFlag({ defaultTuiAgent: 'codex' })
    expect(result.settings.defaultTuiAgent).toBeNull()
    expect(result.needsSave).toBe(true)
  })

  it('keeps blank and supported default agents', () => {
    expect(normalizeWithSaveFlag({ defaultTuiAgent: 'blank' }).settings.defaultTuiAgent).toBe(
      'blank'
    )
    expect(normalizeWithSaveFlag({ defaultTuiAgent: 'pi' }).settings.defaultTuiAgent).toBe('pi')
  })

  it('clears retired source control agents without remapping', () => {
    const defaults = getDefaultPersistedState(homedir())
    const result = normalizeWithSaveFlag({
      sourceControlAi: { ...defaults.settings.sourceControlAi, agentId: 'codex' },
      commitMessageAi: { ...defaults.settings.commitMessageAi, agentId: 'codex' }
    })
    expect(result.settings.sourceControlAi?.agentId).toBeNull()
    expect(result.settings.commitMessageAi?.agentId).toBeNull()
    expect(result.needsSave).toBe(true)
  })

  it('keeps supported and custom source control agents', () => {
    const defaults = getDefaultPersistedState(homedir())
    for (const agentId of ['opencode', 'custom']) {
      const result = normalizeWithSaveFlag({
        sourceControlAi: { ...defaults.settings.sourceControlAi, agentId },
        commitMessageAi: { ...defaults.settings.commitMessageAi, agentId }
      })
      expect(result.settings.sourceControlAi?.agentId).toBe(agentId)
      expect(result.settings.commitMessageAi?.agentId).toBe(agentId)
    }
  })
})
