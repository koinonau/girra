import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { RateLimitService } from './service'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { fetchMiniMaxRateLimits } from './minimax/minimax-fetcher'
import { fetchOpenCodeGoRateLimits } from './opencode-go-usage-fetcher'
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

function serviceInternals(service: RateLimitService): { fetchAll: () => Promise<void> } {
  return service as unknown as { fetchAll: () => Promise<void> }
}

describe('RateLimitService', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
  })

  it('does not refetch OpenCode Go when a Claude account switch is queued during fetchAll', async () => {
    const service = new RateLimitService()
    const firstClaude = deferred<ProviderRateLimits>()
    const firstOpenCode = deferred<ProviderRateLimits>()

    vi.mocked(fetchClaudeRateLimits)
      .mockImplementationOnce(() => firstClaude.promise)
      .mockResolvedValueOnce(okProvider('claude', 42))
    vi.mocked(fetchOpenCodeGoRateLimits).mockImplementationOnce(() => firstOpenCode.promise)

    const fullRefresh = service.refresh()
    await Promise.resolve()

    const switchRefresh = service.refreshForClaudeAccountChange()
    await Promise.resolve()

    firstClaude.resolve(okProvider('claude', 18))
    firstOpenCode.resolve(okProvider('opencode-go', 24))

    await fullRefresh
    await switchRefresh

    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(2)
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledTimes(1)
  })

  it('keeps recent stale data across repeated failures', async () => {
    const service = new RateLimitService()
    const internal = serviceInternals(service)

    vi.mocked(fetchClaudeRateLimits)
      .mockResolvedValueOnce(okProvider('claude', 33, Date.now()))
      .mockResolvedValueOnce(errorProvider('claude', 'temporary failure'))
      .mockResolvedValueOnce(errorProvider('claude', 'still failing'))

    await internal.fetchAll()
    await internal.fetchAll()

    let state = service.getState()
    expect(state.claude?.status).toBe('error')
    expect(state.claude?.session?.usedPercent).toBe(33)

    await internal.fetchAll()

    state = service.getState()
    expect(state.claude?.status).toBe('error')
    expect(state.claude?.session?.usedPercent).toBe(33)
    expect(state.claude?.error).toBe('still failing')
  })

  it('bypasses the debounce for explicit manual refreshes', async () => {
    const service = new RateLimitService()

    vi.mocked(fetchClaudeRateLimits)
      .mockResolvedValueOnce(okProvider('claude', 10, Date.now()))
      .mockResolvedValueOnce(okProvider('claude', 11, Date.now()))

    vi.mocked(fetchOpenCodeGoRateLimits)
      .mockResolvedValueOnce(okProvider('opencode-go', 20, Date.now()))
      .mockResolvedValueOnce(okProvider('opencode-go', 21, Date.now()))

    await service.refresh()
    await service.refresh()

    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(2)
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledTimes(2)
  })

  it('does not refetch fresh provider data for replayed mobile subscriptions', async () => {
    const service = new RateLimitService()
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 10))
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue(okProvider('opencode-go', 20))

    await service.refreshIfStale()
    await service.refreshIfStale()
    await service.refreshIfStale()

    expect(fetchClaudeRateLimits).toHaveBeenCalledOnce()
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledOnce()
  })

  it('does not queue a follow-up fetch when a mobile subscription replays mid-fetch', async () => {
    const service = new RateLimitService()
    const claude = deferred<ProviderRateLimits>()
    const openCode = deferred<ProviderRateLimits>()
    vi.mocked(fetchClaudeRateLimits).mockReturnValue(claude.promise)
    vi.mocked(fetchOpenCodeGoRateLimits).mockReturnValue(openCode.promise)

    const firstRefresh = service.refreshIfStale()
    await Promise.resolve()
    const replayedRefresh = service.refreshIfStale()

    claude.resolve(okProvider('claude', 10))
    openCode.resolve(okProvider('opencode-go', 20))
    await firstRefresh
    await replayedRefresh

    expect(fetchClaudeRateLimits).toHaveBeenCalledOnce()
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledOnce()
  })

  it('waits for a queued explicit refresh when another fetch is already in flight', async () => {
    const service = new RateLimitService()
    const firstClaude = deferred<ProviderRateLimits>()
    const firstOpenCode = deferred<ProviderRateLimits>()
    const secondClaude = deferred<ProviderRateLimits>()
    const secondOpenCode = deferred<ProviderRateLimits>()

    vi.mocked(fetchClaudeRateLimits)
      .mockImplementationOnce(() => firstClaude.promise)
      .mockImplementationOnce(() => secondClaude.promise)
    vi.mocked(fetchOpenCodeGoRateLimits)
      .mockImplementationOnce(() => firstOpenCode.promise)
      .mockImplementationOnce(() => secondOpenCode.promise)

    const backgroundFetch = serviceInternals(service).fetchAll()
    await Promise.resolve()

    let refreshResolved = false
    const manualRefresh = service.refresh().then(() => {
      refreshResolved = true
    })
    await Promise.resolve()

    firstClaude.resolve(okProvider('claude', 10, Date.now()))
    firstOpenCode.resolve(okProvider('opencode-go', 20, Date.now()))
    await Promise.resolve()

    expect(refreshResolved).toBe(false)

    secondClaude.resolve(okProvider('claude', 11, Date.now()))
    secondOpenCode.resolve(okProvider('opencode-go', 21, Date.now()))
    await backgroundFetch
    await manualRefresh

    expect(refreshResolved).toBe(true)
    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(2)
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledTimes(2)
  })

  it('aborts the active fetch cycle and clears queued refreshes on stop', async () => {
    const service = new RateLimitService()
    const capturedSignals: { claude?: AbortSignal } = {}

    vi.mocked(fetchClaudeRateLimits).mockImplementation(
      (options) =>
        new Promise((resolve) => {
          capturedSignals.claude = options?.signal
          options?.signal?.addEventListener(
            'abort',
            () => resolve(errorProvider('claude', 'aborted')),
            { once: true }
          )
        })
    )

    const activeFetch = serviceInternals(service).fetchAll()
    await Promise.resolve()
    await Promise.resolve()

    const queuedRefresh = service.refresh()
    await Promise.resolve()

    service.stop()

    expect(capturedSignals.claude?.aborted).toBe(true)

    await queuedRefresh
    await activeFetch

    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(1)
  })

  it('fetches OpenCode Go alongside Claude', async () => {
    const service = new RateLimitService()
    service.setOpenCodeGoConfigResolver(() => ({
      sessionCookie: 'session=abc123',
      workspaceIdOverride: ''
    }))
    const networkProxySettings = {
      httpProxyUrl: 'http://proxy.example:8080',
      httpProxyBypassRules: 'localhost'
    }
    service.setNetworkProxySettingsResolver(() => networkProxySettings)

    vi.mocked(fetchClaudeRateLimits).mockResolvedValueOnce(okProvider('claude', 10, Date.now()))
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValueOnce(
      okProvider('opencode-go', 40, Date.now())
    )

    await service.refresh()

    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(1)
    expect(fetchClaudeRateLimits).toHaveBeenCalledWith(
      expect.objectContaining({
        authPreparation: undefined,
        allowPtyFallback: false,
        allowUsagePanelSupplement: true,
        signal: expect.any(AbortSignal)
      })
    )
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledTimes(1)
    expect(fetchOpenCodeGoRateLimits).toHaveBeenCalledWith(
      'session=abc123',
      undefined,
      networkProxySettings
    )

    const state = service.getState()
    expect(state.claude?.status).toBe('ok')
    expect(state.claude?.session?.usedPercent).toBe(10)
    expect(state.opencodeGo?.status).toBe('ok')
    expect(state.opencodeGo?.session?.usedPercent).toBe(40)
  })

  it('isolates provider failures so one error does not block others', async () => {
    const service = new RateLimitService()
    service.setOpenCodeGoConfigResolver(() => ({
      sessionCookie: '',
      workspaceIdOverride: ''
    }))

    vi.mocked(fetchClaudeRateLimits).mockRejectedValueOnce(new Error('claude down'))
    vi.mocked(fetchMiniMaxRateLimits).mockRejectedValueOnce(new Error('minimax down'))
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValueOnce(
      okProvider('opencode-go', 40, Date.now())
    )

    await service.refresh()

    const state = service.getState()
    expect(state.claude?.status).toBe('error')
    expect(state.claude?.error).toBe('claude down')
    expect(state.minimax?.status).toBe('error')
    expect(state.minimax?.error).toBe('minimax down')
    expect(state.opencodeGo?.status).toBe('ok')
  })

  it('discards stale data when a provider becomes unavailable', async () => {
    const service = new RateLimitService()
    let cookie = 'session=valid'
    service.setOpenCodeGoConfigResolver(() => ({
      sessionCookie: cookie,
      workspaceIdOverride: ''
    }))

    // 1. Success fetch
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 10, Date.now()))
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue(
      okProvider('opencode-go', 40, Date.now())
    )

    await service.refresh()
    expect(service.getState().opencodeGo?.session?.usedPercent).toBe(40)

    // 2. Clear cookie -> should become unavailable and LOSE the 40% data
    cookie = ''
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue({
      provider: 'opencode-go',
      session: null,
      weekly: null,
      monthly: null,
      updatedAt: Date.now(),
      error: 'Session cookie not configured',
      status: 'unavailable'
    })

    await service.refresh()
    const state = service.getState()
    expect(state.opencodeGo?.status).toBe('unavailable')
    expect(state.opencodeGo?.session).toBeNull()
    expect(state.opencodeGo?.error).toBe('Session cookie not configured')
  })

  it('discards stale data when Workspace ID override is changed', async () => {
    const service = new RateLimitService()
    let workspaceId = 'wrk_A'
    service.setOpenCodeGoConfigResolver(() => ({
      sessionCookie: 'session=valid',
      workspaceIdOverride: workspaceId
    }))

    // 1. Success fetch for Workspace A
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue(
      okProvider('opencode-go', 40, Date.now())
    )
    await service.refresh()
    expect(service.getState().opencodeGo?.session?.usedPercent).toBe(40)

    // 2. Change Workspace ID to B -> old data from A should be discarded
    workspaceId = 'wrk_B'
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue(
      okProvider('opencode-go', 10, Date.now())
    )
    await service.refresh()
    expect(service.getState().opencodeGo?.session?.usedPercent).toBe(10)

    // 3. Clear Workspace ID (automatic) but it fails -> should show error, NOT stale data from B
    workspaceId = ''
    vi.mocked(fetchOpenCodeGoRateLimits).mockResolvedValue({
      provider: 'opencode-go',
      session: null,
      weekly: null,
      monthly: null,
      updatedAt: Date.now(),
      error: 'No workspace ID found',
      status: 'error'
    })
    await service.refresh()
    const state = service.getState()
    expect(state.opencodeGo?.status).toBe('error')
    expect(state.opencodeGo?.session).toBeNull()
    expect(state.opencodeGo?.error).toBe('No workspace ID found')
  })
})
