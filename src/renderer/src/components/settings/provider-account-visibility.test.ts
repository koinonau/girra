import { describe, expect, it } from 'vitest'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import {
  getProviderAccountActiveIdForView,
  getProviderAccountRuntime,
  providerAccountIsActiveInView,
  providerAccountMatchesView
} from './provider-account-visibility'

const claudeWslAccount = {
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
} satisfies ClaudeRateLimitAccountsState['accounts'][number]

const claudeHostAccount = {
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
} satisfies ClaudeRateLimitAccountsState['accounts'][number]

describe('providerAccountMatchesView', () => {
  it('shows WSL accounts owned by a Windows server regardless of the client platform', () => {
    expect(
      providerAccountMatchesView(
        claudeWslAccount,
        { runtime: 'host' },
        {
          remoteOwner: true,
          ownerPlatform: 'win32'
        }
      )
    ).toBe(true)
  })

  it('does not expose stale WSL accounts from a non-Windows remote runtime', () => {
    expect(
      providerAccountMatchesView(
        claudeWslAccount,
        { runtime: 'host' },
        {
          remoteOwner: true,
          ownerPlatform: 'linux'
        }
      )
    ).toBe(false)
    expect(
      providerAccountMatchesView(
        claudeHostAccount,
        { runtime: 'wsl' },
        {
          remoteOwner: true,
          ownerPlatform: 'linux'
        }
      )
    ).toBe(true)
  })

  it('keeps local host and WSL views isolated by runtime and distro', () => {
    const localOptions = { remoteOwner: false, ownerPlatform: 'win32' as const }

    expect(providerAccountMatchesView(claudeWslAccount, { runtime: 'host' }, localOptions)).toBe(
      false
    )
    expect(
      providerAccountMatchesView(
        claudeWslAccount,
        { runtime: 'wsl', wslDistro: 'Ubuntu' },
        localOptions
      )
    ).toBe(true)
    expect(
      providerAccountMatchesView(
        claudeWslAccount,
        { runtime: 'wsl', wslDistro: 'Debian' },
        localOptions
      )
    ).toBe(false)
  })

  it('hides WSL accounts while remote owner platform is still unknown', () => {
    // Why: unknown platform is fail-closed so stale WSL rows do not flash on a
    // non-Windows remote while capabilities load.
    expect(
      providerAccountMatchesView(
        claudeWslAccount,
        { runtime: 'host' },
        {
          remoteOwner: true,
          ownerPlatform: null
        }
      )
    ).toBe(false)
    expect(
      providerAccountMatchesView(
        claudeHostAccount,
        { runtime: 'host' },
        {
          remoteOwner: true,
          ownerPlatform: null
        }
      )
    ).toBe(true)
  })
})

describe('providerAccountIsActiveInView', () => {
  it('detects a remote WSL selection change even when the host selection is unchanged', () => {
    const before = {
      activeAccountId: 'claude-host',
      activeAccountIdsByRuntime: {
        host: 'claude-host',
        wsl: { Ubuntu: 'claude-wsl-old' }
      }
    }
    const after = {
      ...before,
      activeAccountIdsByRuntime: {
        ...before.activeAccountIdsByRuntime,
        wsl: { Ubuntu: 'claude-wsl' }
      }
    }
    const actionRuntime = getProviderAccountRuntime(claudeWslAccount)

    // Why: AccountsPane's remote view is forced to host, but restart prompts
    // must compare the WSL slot changed by selecting or removing this row.
    expect(getProviderAccountActiveIdForView(before, actionRuntime)).toBe('claude-wsl-old')
    expect(getProviderAccountActiveIdForView(after, actionRuntime)).toBe('claude-wsl')
    expect(getProviderAccountActiveIdForView(before, { runtime: 'host' })).toBe(
      getProviderAccountActiveIdForView(after, { runtime: 'host' })
    )
  })

  it('marks remote WSL accounts active from their own runtime selection', () => {
    const selection = {
      activeAccountId: 'claude-host',
      activeAccountIdsByRuntime: {
        host: 'claude-host',
        wsl: { Ubuntu: 'claude-wsl' }
      }
    }

    // Why: remote Windows forces the host view filter, but Active must still
    // light for the WSL slot that actually selected this account.
    expect(
      providerAccountIsActiveInView(
        claudeWslAccount,
        selection,
        { runtime: 'host' },
        { remoteOwner: true }
      )
    ).toBe(true)
    expect(
      providerAccountIsActiveInView(
        claudeHostAccount,
        selection,
        { runtime: 'host' },
        { remoteOwner: true }
      )
    ).toBe(true)
  })

  it('keeps local Active scoped to the selected host/WSL view', () => {
    const selection = {
      activeAccountId: 'claude-host',
      activeAccountIdsByRuntime: {
        host: 'claude-host',
        wsl: { Ubuntu: 'claude-wsl' }
      }
    }

    expect(
      providerAccountIsActiveInView(
        claudeHostAccount,
        selection,
        { runtime: 'host' },
        { remoteOwner: false }
      )
    ).toBe(true)
    expect(
      providerAccountIsActiveInView(
        claudeWslAccount,
        selection,
        { runtime: 'host' },
        { remoteOwner: false }
      )
    ).toBe(false)
    expect(
      providerAccountIsActiveInView(
        claudeWslAccount,
        selection,
        { runtime: 'wsl', wslDistro: 'Ubuntu' },
        { remoteOwner: false }
      )
    ).toBe(true)
  })
})
