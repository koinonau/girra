import { describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import {
  buildClaudeStatusSwitchGroups,
  getStatusBarPreferredWslDistro,
  resolveClaudeStatusAccountState
} from './StatusBar'

const hostLabel = navigator.userAgent.includes('Windows') ? 'Windows' : 'This device'

describe('status bar runtime switch groups', () => {
  it('collapses WSL default into the single concrete Claude distro', () => {
    const state: ClaudeRateLimitAccountsState = {
      accounts: [
        {
          id: 'claude-wsl',
          email: 'wsl@example.com',
          managedAuthRuntime: 'wsl',
          wslDistro: 'Ubuntu',
          authMethod: 'subscription-oauth',
          organizationUuid: null,
          organizationName: null,
          createdAt: 1,
          updatedAt: 1,
          lastAuthenticatedAt: 1
        }
      ],
      activeAccountId: null,
      activeAccountIdsByRuntime: { host: null, wsl: { Ubuntu: 'claude-wsl' } }
    }

    expect(
      buildClaudeStatusSwitchGroups(state, { runtime: 'wsl', wslDistro: null }).map((group) => ({
        key: group.key,
        label: group.label
      }))
    ).toEqual([
      { key: 'host', label: hostLabel },
      { key: 'wsl:Ubuntu', label: 'WSL Ubuntu' }
    ])
  })

  it('keeps the Claude WSL toggle available when Windows is selected', () => {
    const state: ClaudeRateLimitAccountsState = {
      accounts: [
        {
          id: 'claude-host',
          email: 'host@example.com',
          managedAuthRuntime: 'host',
          wslDistro: null,
          authMethod: 'subscription-oauth',
          organizationUuid: null,
          organizationName: null,
          createdAt: 1,
          updatedAt: 1,
          lastAuthenticatedAt: 1
        },
        {
          id: 'claude-wsl',
          email: 'wsl@example.com',
          managedAuthRuntime: 'wsl',
          wslDistro: 'Ubuntu',
          authMethod: 'subscription-oauth',
          organizationUuid: null,
          organizationName: null,
          createdAt: 2,
          updatedAt: 2,
          lastAuthenticatedAt: 2
        }
      ],
      activeAccountId: 'claude-host',
      activeAccountIdsByRuntime: { host: 'claude-host', wsl: { Ubuntu: 'claude-wsl' } }
    }

    expect(
      buildClaudeStatusSwitchGroups(state, { runtime: 'host', wslDistro: null }).map((group) => ({
        key: group.key,
        label: group.label
      }))
    ).toEqual([
      { key: 'host', label: hostLabel },
      { key: 'wsl:Ubuntu', label: 'WSL Ubuntu' }
    ])
  })

  it('keeps Claude WSL system-default available without managed Claude accounts', () => {
    const state: ClaudeRateLimitAccountsState = {
      accounts: [],
      activeAccountId: null,
      activeAccountIdsByRuntime: { host: null, wsl: {} }
    }

    expect(
      buildClaudeStatusSwitchGroups(
        state,
        { runtime: 'host', wslDistro: null },
        { includeFallbackWsl: true, fallbackWslDistro: 'Ubuntu' }
      ).map((group) => ({
        key: group.key,
        label: group.label,
        targets: group.targets.map((target) => target.label)
      }))
    ).toEqual([
      { key: 'host', label: hostLabel, targets: ['System default'] },
      { key: 'wsl:Ubuntu', label: 'WSL Ubuntu', targets: ['System default'] }
    ])
  })

  it('ignores stale terminal WSL distro for account runtime fallback groups', () => {
    expect(
      getStatusBarPreferredWslDistro(
        {
          localAccountRuntime: 'wsl',
          localAccountWslDistro: null,
          terminalWindowsWslDistro: 'Debian'
        } as GlobalSettings,
        ['Ubuntu'],
        'win32'
      )
    ).toBe('Ubuntu')
  })

  it('uses the account WSL distro before single-distro fallback groups', () => {
    expect(
      getStatusBarPreferredWslDistro(
        {
          localAccountRuntime: 'wsl',
          localAccountWslDistro: 'Fedora',
          terminalWindowsWslDistro: 'Debian'
        } as GlobalSettings,
        ['Ubuntu'],
        'win32'
      )
    ).toBe('Fedora')
  })

  it('uses the auto runtime distro instead of a stale account-runtime distro', () => {
    expect(
      getStatusBarPreferredWslDistro(
        {
          localAccountRuntime: 'auto',
          localAccountWslDistro: 'Fedora',
          localWindowsRuntimeDefault: { kind: 'wsl', distro: 'Ubuntu' }
        } as GlobalSettings,
        ['Fedora', 'Ubuntu'],
        'win32'
      )
    ).toBe('Ubuntu')
  })

  it('labels the host account group with the active remote server name', () => {
    const state: ClaudeRateLimitAccountsState = {
      accounts: [],
      activeAccountId: null,
      activeAccountIdsByRuntime: { host: null, wsl: {} }
    }

    expect(
      buildClaudeStatusSwitchGroups(
        state,
        { runtime: 'host', wslDistro: null },
        { hostLabel: 'Repro Server' }
      )[0]?.label
    ).toBe('Repro Server')
  })

  it('prefers the runtime snapshot for Claude accounts when a remote server is active', () => {
    const remoteState: ClaudeRateLimitAccountsState = {
      accounts: [],
      activeAccountId: null,
      activeAccountIdsByRuntime: { host: null, wsl: {} }
    }
    const settings = {
      activeRuntimeEnvironmentId: 'env-1',
      activeClaudeManagedAccountId: 'desktop-claude-1',
      activeClaudeManagedAccountIdsByRuntime: { host: 'desktop-claude-1', wsl: {} },
      claudeManagedAccounts: [
        {
          id: 'desktop-claude-1',
          email: 'desktop@example.com',
          managedAuthPath: '/tmp/desktop-claude-1',
          authMethod: 'subscription-oauth',
          createdAt: 1,
          updatedAt: 1,
          lastAuthenticatedAt: 1
        }
      ]
    } as GlobalSettings

    expect(resolveClaudeStatusAccountState(settings, remoteState)).toBe(remoteState)
    expect(
      resolveClaudeStatusAccountState(
        { ...settings, activeRuntimeEnvironmentId: '   ' },
        remoteState
      ).accounts.map((account) => account.id)
    ).toEqual(['desktop-claude-1'])
  })
})
