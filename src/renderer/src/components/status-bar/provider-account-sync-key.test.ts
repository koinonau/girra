import { describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { getClaudeAccountSyncKey } from './provider-account-sync-key'

function makeSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    activeRuntimeEnvironmentId: null,
    activeClaudeManagedAccountId: null,
    activeClaudeManagedAccountIdsByRuntime: null,
    claudeManagedAccounts: [{ id: 'a1', updatedAt: 5 }],
    ...overrides
  } as unknown as GlobalSettings
}

describe('claude account sync key', () => {
  const getSyncKey = getClaudeAccountSyncKey

  it('returns the same string for the same settings identity', () => {
    const settings = makeSettings()
    expect(getSyncKey(settings)).toBe(getSyncKey(settings))
  })

  it('answers no-settings when settings are absent', () => {
    expect(getSyncKey(null)).toBe('no-settings')
    expect(getSyncKey(undefined)).toBe('no-settings')
  })

  it('recomputes for a new settings identity', () => {
    const first = getSyncKey(makeSettings())
    const second = getSyncKey(
      makeSettings({
        claudeManagedAccounts: [{ id: 'a1', updatedAt: 6 }]
      } as unknown as Partial<GlobalSettings>)
    )
    expect(second).not.toBe(first)
  })
})
