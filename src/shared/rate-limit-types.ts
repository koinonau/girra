export type RateLimitWindow = {
  /** Percentage of the window consumed (0–100). */
  usedPercent: number
  /** Window duration in minutes: 300 (5h) or 10080 (7d). */
  windowMinutes: number
  /** Unix ms timestamp when the window resets, if known. */
  resetsAt: number | null
  /** Human-readable reset description, e.g. "2:30 PM" or "Thu". */
  resetDescription: string | null
}

export type ProviderRateLimitStatus = 'idle' | 'fetching' | 'ok' | 'error' | 'unavailable'

export type UsageRateLimitSource = 'oauth' | 'cli' | 'web' | 'live-session'

export type UsageRateLimitFailureKind =
  | 'missing-credentials'
  | 'stale-token'
  | 'refreshable-credentials-without-token'
  | 'delegated-refresh-required'
  | 'deferred-by-live-session'
  | 'keychain-unavailable'
  | 'missing-scope'
  | 'network'
  | 'server'
  | 'parse'
  | 'rate-limited'
  | 'cli-unavailable'
  | 'usage-unavailable'
  | 'unknown'

export type UsageRateLimitMetadata = {
  source?: UsageRateLimitSource
  attemptedSources?: UsageRateLimitSource[]
  failureKind?: UsageRateLimitFailureKind
  credentialSource?: string
  authProvenance?: string
  deferredByLiveClaudeSession?: boolean
  lastSuccessfulSource?: UsageRateLimitSource
  /** Unix ms timestamp before which usage refetches should not be attempted (from HTTP Retry-After). */
  retryAtMs?: number
}

export type ProviderRateLimits = {
  provider: 'claude' | 'opencode-go' | 'minimax'
  /** 5-hour session window, null if not available. */
  session: RateLimitWindow | null
  /** 7-day weekly window, null if not available. */
  weekly: RateLimitWindow | null
  /** Claude Fable 7-day weekly window, null if not available. */
  fableWeekly?: RateLimitWindow | null
  /** 30-day monthly window (OpenCode Go), null if not available. */
  monthly?: RateLimitWindow | null
  /** Unix ms timestamp of the last successful data update. */
  updatedAt: number
  /** Human-readable error message, null when status is 'ok'. */
  error: string | null
  status: ProviderRateLimitStatus
  usageMetadata?: UsageRateLimitMetadata
}

export type RateLimitRuntimeTarget = {
  runtime: 'host' | 'wsl'
  wslDistro: string | null
}

export type InactiveAccountUsage = {
  accountId: string
  rateLimits: ProviderRateLimits | null
  updatedAt: number
  isFetching: boolean
}

export type RateLimitState = {
  claude: ProviderRateLimits | null
  /** Retired Codex slot, always null. Older paired clients still dereference it. */
  codex: null
  opencodeGo: ProviderRateLimits | null
  minimax: ProviderRateLimits | null
  /**
   * True when a MiniMax session cookie is persisted on disk. The cookie lives
   * outside GlobalSettings, so this flag is the durable signal that the
   * status bar uses to keep the MiniMax provider visible across reloads and
   * between snapshot refreshes.
   */
  minimaxCookieConfigured: boolean
  /**
   * True when a MiniMax API key is persisted on disk. The key value itself
   * never leaves main, so the renderer only sees this boolean. The status bar
   * ORs it with the cookie flag to decide whether to keep the MiniMax bar
   * visible across reloads.
   */
  minimaxApiKeyConfigured: boolean
  claudeTarget: RateLimitRuntimeTarget
  /** Retired, always host. Older paired clients still read `codexTarget.runtime`. */
  codexTarget: { runtime: 'host'; wslDistro: null }
  inactiveClaudeAccounts: InactiveAccountUsage[]
  /** Retired, always empty. Older paired clients still call `inactiveCodexAccounts.find`. */
  inactiveCodexAccounts: never[]
}
