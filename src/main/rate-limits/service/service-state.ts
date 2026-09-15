import type { BrowserWindow } from 'electron'
import type {
  InactiveAccountUsage,
  ProviderRateLimits,
  RateLimitState
} from '../../../shared/rate-limit-types'
import {
  type ActiveRateLimitProvider,
  type InternalRateLimitState,
  type ClaudeAuthPreparationResolver,
  type OpenCodeGoRateLimitConfig,
  type MiniMaxRateLimitConfig,
  type NormalizedClaudeAccountSelectionTarget,
  type InactiveClaudeAccountInfo,
  type NetworkProxySettings,
  DEFAULT_POLL_MS
} from './service-types'

export abstract class RateLimitServiceState {
  protected state: InternalRateLimitState = {
    claude: null,
    opencodeGo: null,
    minimax: null
  }
  protected pollInterval: number = DEFAULT_POLL_MS
  protected timer: ReturnType<typeof setInterval> | null = null
  protected deferredStartupRefreshTimer: ReturnType<typeof setTimeout> | null = null
  // Why: throttle repeated focus/show/restore events so one outage doesn't create a tight provider retry loop.
  protected lastActiveFailureRetryAtByProvider: Record<ActiveRateLimitProvider, number> = {
    claude: 0,
    'opencode-go': 0,
    minimax: 0
  }
  // Why: consecutive failures drive exponential backoff of the fast activation-retry lane; reset on any success/unavailable result.
  protected activeFailureStreakByProvider: Record<ActiveRateLimitProvider, number> = {
    claude: 0,
    'opencode-go': 0,
    minimax: 0
  }
  protected mainWindow: BrowserWindow | null = null
  protected detachWindowListeners: (() => void) | null = null
  protected isFetching = false
  protected fullFetchQueued = false
  protected claudeOnlyFetchQueued = false
  protected activeFetchAbortControllers = new Set<AbortController>()
  protected fetchIdleResolvers: (() => void)[] = []
  protected claudeFetchGeneration = 0
  // Why: statusline ingest must attribute live windows to the selected account without re-running the side-effectful auth sync per post.
  protected lastClaudeAuthSnapshot: { configDir: string | null; provenance: string } | null = null
  protected opencodeFetchGeneration = 0
  protected minimaxFetchGeneration = 0
  protected lastOpencodeConfigHash = ''
  protected lastMiniMaxConfigHash = ''
  protected claudeAuthPreparationResolver: ClaudeAuthPreparationResolver | null = null
  protected claudeFetchTarget: NormalizedClaudeAccountSelectionTarget = {
    runtime: 'host',
    wslDistro: null
  }
  protected openCodeGoConfigResolver: (() => OpenCodeGoRateLimitConfig) | null = null
  protected miniMaxConfigResolver: (() => MiniMaxRateLimitConfig) | null = null
  protected inactiveClaudeAccountsResolver: (() => InactiveClaudeAccountInfo[]) | null = null
  protected networkProxySettingsResolver: (() => NetworkProxySettings) | null = null
  protected inactiveClaudeCache = new Map<string, ProviderRateLimits>()
  protected inactiveClaudeFetching = new Set<string>()
  protected lastInactiveClaudeFetchAt = 0
  protected inactiveClaudeAccountsGeneration = 0
  protected stateListeners = new Set<(state: RateLimitState) => void>()

  constructor() {}

  onStateChange(listener: (state: RateLimitState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  protected abstract getState(): RateLimitState

  protected buildInactiveArray(
    cache: Map<string, ProviderRateLimits>,
    fetching: Set<string>
  ): InactiveAccountUsage[] {
    const result: InactiveAccountUsage[] = []
    for (const [accountId, limits] of cache) {
      result.push({
        accountId,
        rateLimits: limits,
        updatedAt: limits.updatedAt,
        isFetching: fetching.has(accountId)
      })
    }
    // Why: include fetching-but-uncached accounts so the renderer shows a loading indicator for newly added accounts.
    for (const accountId of fetching) {
      if (!cache.has(accountId)) {
        result.push({
          accountId,
          rateLimits: null,
          updatedAt: 0,
          isFetching: true
        })
      }
    }
    return result
  }

  protected updateState(next: InternalRateLimitState): void {
    this.state = next
    this.pushToRenderer()
  }

  protected pushToRenderer(): void {
    const state = this.getState()
    for (const listener of this.stateListeners) {
      try {
        listener(state)
      } catch {
        // ignore — one bad listener must not break the others
      }
    }
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }
    this.mainWindow.webContents.send('rateLimits:update', state)
  }
}
