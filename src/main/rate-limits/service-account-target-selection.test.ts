import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { okProvider, resetRateLimitProviderMocks } from './rate-limit-service-test-harness'

vi.mock('./claude-fetcher', () => ({
  fetchClaudeRateLimits: vi.fn(),
  fetchManagedAccountUsage: vi.fn()
}))

vi.mock('./opencode-go-usage-fetcher', () => ({
  fetchOpenCodeGoRateLimits: vi.fn()
}))

vi.mock('./minimax/minimax-fetcher', () => ({
  fetchMiniMaxRateLimits: vi.fn()
}))

vi.mock('../minimax/minimax-cookie-store', () => ({
  hasMiniMaxSessionCookie: vi.fn(() => false)
}))

describe('RateLimitService', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
  })

  it('publishes the retired Codex fields with inert values for older paired clients', async () => {
    const service = new RateLimitService()
    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))

    await service.refresh()

    expect(service.getState()).toMatchObject({
      codex: null,
      codexTarget: { runtime: 'host', wslDistro: null },
      inactiveCodexAccounts: []
    })
  })

  it('uses the initialized WSL target for active Claude rate-limit fetches', async () => {
    const service = new RateLimitService()
    const resolver = vi.fn(async (target) => ({
      configDir:
        target?.runtime === 'wsl'
          ? '\\\\wsl.localhost\\Ubuntu\\home\\jin\\.claude'
          : 'C:\\Users\\jin\\.claude',
      runtime: target?.runtime ?? 'host',
      wslDistro: target?.wslDistro ?? null,
      wslLinuxConfigDir: target?.runtime === 'wsl' ? '/home/jin/.claude' : null,
      envPatch: target?.runtime === 'wsl' ? { CLAUDE_CONFIG_DIR: '/home/jin/.claude' } : {},
      stripAuthEnv: target?.runtime === 'wsl',
      provenance: target?.runtime === 'wsl' ? 'managed:wsl-account:wsl:Ubuntu' : 'system'
    }))
    service.setClaudeAuthPreparationResolver(resolver)
    service.setClaudeFetchTarget({ runtime: 'wsl', wslDistro: 'Ubuntu' })

    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))

    await service.refresh()

    expect(resolver).toHaveBeenCalledWith({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    expect(fetchClaudeRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        authPreparation: expect.objectContaining({
          runtime: 'wsl',
          wslDistro: 'Ubuntu',
          wslLinuxConfigDir: '/home/jin/.claude',
          stripAuthEnv: true
        }),
        allowPtyFallback: true,
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
    expect(service.getState().claudeTarget).toEqual({ runtime: 'wsl', wslDistro: 'Ubuntu' })
  })

  it('does not use Claude PTY fallback for system-default usage refreshes', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => ({
      configDir: '/tmp/.claude',
      runtime: 'host',
      wslDistro: null,
      wslLinuxConfigDir: null,
      envPatch: {},
      stripAuthEnv: false,
      provenance: 'system'
    }))

    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))

    await service.refresh()

    expect(fetchClaudeRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        authPreparation: expect.objectContaining({ provenance: 'system' }),
        allowPtyFallback: false,
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('does not use Claude PTY fallback when Claude auth preparation is unavailable', async () => {
    const service = new RateLimitService()

    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))

    await service.refresh()

    expect(fetchClaudeRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        authPreparation: undefined,
        allowPtyFallback: false,
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('does not use Claude PTY fallback for WSL system-default usage refreshes', async () => {
    const service = new RateLimitService()
    service.setClaudeFetchTarget({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    service.setClaudeAuthPreparationResolver(async () => ({
      configDir: '\\\\wsl.localhost\\Ubuntu\\home\\jin\\.claude',
      runtime: 'wsl',
      wslDistro: 'Ubuntu',
      wslLinuxConfigDir: '/home/jin/.claude',
      envPatch: {},
      stripAuthEnv: true,
      provenance: 'wsl:Ubuntu:system'
    }))

    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))

    await service.refresh()

    expect(fetchClaudeRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        authPreparation: expect.objectContaining({ provenance: 'wsl:Ubuntu:system' }),
        allowPtyFallback: false,
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('does not cache host Claude usage under an outgoing WSL account', async () => {
    const service = new RateLimitService()
    service.setInactiveClaudeAccountsResolver(() => [
      { id: 'wsl-account-1', managedAuthPath: '/tmp/account-1/auth' }
    ])
    service.setClaudeAuthPreparationResolver(async (target) => ({
      configDir:
        target?.runtime === 'wsl'
          ? '\\\\wsl.localhost\\Ubuntu\\home\\jin\\.claude'
          : 'C:\\Users\\jin\\.claude',
      runtime: target?.runtime ?? 'host',
      wslDistro: target?.wslDistro ?? null,
      wslLinuxConfigDir: target?.runtime === 'wsl' ? '/home/jin/.claude' : null,
      envPatch: {},
      stripAuthEnv: target?.runtime === 'wsl',
      provenance: target?.runtime === 'wsl' ? 'managed:wsl-account-1:wsl:Ubuntu' : 'system'
    }))

    vi.mocked(fetchClaudeRateLimits)
      .mockResolvedValueOnce(okProvider('claude', 20, Date.now()))
      .mockResolvedValueOnce(okProvider('claude', 40, Date.now()))

    await service.refresh()
    await service.refreshForClaudeAccountChange('wsl-account-1', {
      runtime: 'wsl',
      wslDistro: 'Ubuntu'
    })

    expect(fetchClaudeRateLimits).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowPtyFallback: true, allowUsagePanelSupplement: true })
    )

    expect(service.getState().inactiveClaudeAccounts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ accountId: 'wsl-account-1' })])
    )
  })
})
