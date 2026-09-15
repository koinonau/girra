import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { RateLimitService } from './service'
import { fetchClaudeRateLimits, fetchManagedAccountUsage } from './claude-fetcher'
import {
  deferred,
  errorProvider,
  okProvider,
  resetRateLimitProviderMocks
} from './rate-limit-service-test-harness'

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

  it('aborts inactive Claude preview fetches on stop', async () => {
    const service = new RateLimitService()
    const account = { id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }
    const capturedSignals: { claude?: AbortSignal } = {}
    service.setInactiveClaudeAccountsResolver(() => [account])
    vi.mocked(fetchManagedAccountUsage).mockImplementation(
      (_account, options) =>
        new Promise((resolve) => {
          capturedSignals.claude = options?.signal
          options?.signal?.addEventListener(
            'abort',
            () => resolve(errorProvider('claude', 'aborted')),
            { once: true }
          )
        })
    )

    const previewFetch = service.fetchInactiveClaudeAccountsOnOpen()
    await Promise.resolve()

    service.stop()

    expect(capturedSignals.claude?.aborted).toBe(true)

    await previewFetch

    expect(service.getState().inactiveClaudeAccounts).toEqual([])
  })

  it('allows usage-panel Fable supplements for inactive Claude account previews', async () => {
    const service = new RateLimitService()
    const account = { id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }
    service.setInactiveClaudeAccountsResolver(() => [account])
    vi.mocked(fetchManagedAccountUsage).mockResolvedValueOnce(okProvider('claude', 33, Date.now()))

    await service.fetchInactiveClaudeAccountsOnOpen()

    expect(fetchManagedAccountUsage).toHaveBeenCalledWith(
      account,
      expect.objectContaining({
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('does not start overlapping inactive Claude preview fetches', async () => {
    const service = new RateLimitService()
    const accountFetch = deferred<ProviderRateLimits>()
    service.setInactiveClaudeAccountsResolver(() => [
      { id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }
    ])
    vi.mocked(fetchManagedAccountUsage).mockReturnValueOnce(accountFetch.promise)

    const firstFetch = service.fetchInactiveClaudeAccountsOnOpen()
    await Promise.resolve()
    await service.fetchInactiveClaudeAccountsOnOpen()

    expect(fetchManagedAccountUsage).toHaveBeenCalledTimes(1)

    accountFetch.resolve(okProvider('claude', 50, Date.now()))
    await firstFetch
  })

  it('does not recache an inactive Claude account removed during fetch-on-open', async () => {
    const service = new RateLimitService()
    const accountFetch = deferred<ProviderRateLimits>()
    let inactiveAccounts = [{ id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }]
    service.setInactiveClaudeAccountsResolver(() => inactiveAccounts)
    service.setClaudeAuthPreparationResolver(async () => ({
      configDir: '/tmp/.claude',
      envPatch: {},
      stripAuthEnv: false,
      provenance: 'system'
    }))
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 7))
    await service.refresh()
    vi.mocked(fetchManagedAccountUsage).mockReturnValueOnce(accountFetch.promise)

    const fetchOnOpen = service.fetchInactiveClaudeAccountsOnOpen()
    await Promise.resolve()
    expect(service.getState().inactiveClaudeAccounts).toEqual([
      { accountId: 'account-1', rateLimits: null, updatedAt: 0, isFetching: true }
    ])

    service.evictInactiveClaudeCache('account-1')
    inactiveAccounts = [{ id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }]
    await service.refreshForClaudeAccountChange('account-1')
    expect(service.getState().inactiveClaudeAccounts[0]?.accountId).toBe('account-1')

    inactiveAccounts = []
    service.evictInactiveClaudeCache('account-1')
    accountFetch.resolve(okProvider('claude', 42))
    await fetchOnOpen

    expect(service.getState().inactiveClaudeAccounts).toEqual([])
  })

  it('does not overwrite inactive Claude cache from a stale same-id fetch', async () => {
    const service = new RateLimitService()
    const accountFetch = deferred<ProviderRateLimits>()
    service.setInactiveClaudeAccountsResolver(() => [
      { id: 'account-1', managedAuthPath: '/tmp/account-1/auth' }
    ])
    service.setClaudeAuthPreparationResolver(async () => ({
      configDir: '/tmp/.claude',
      envPatch: {},
      stripAuthEnv: false,
      provenance: 'system'
    }))
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 7))
    await service.refresh()
    vi.mocked(fetchManagedAccountUsage).mockReturnValueOnce(accountFetch.promise)

    const fetchOnOpen = service.fetchInactiveClaudeAccountsOnOpen()
    await Promise.resolve()

    await service.refreshForClaudeAccountChange('account-1')
    accountFetch.resolve(okProvider('claude', 42))
    await fetchOnOpen

    expect(service.getState().inactiveClaudeAccounts).toEqual([
      {
        accountId: 'account-1',
        rateLimits: expect.objectContaining({
          provider: 'claude',
          session: expect.objectContaining({ usedPercent: 7 })
        }),
        updatedAt: expect.any(Number),
        isFetching: false
      }
    ])
  })
})
