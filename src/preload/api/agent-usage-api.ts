import type { ClaudeUsageBreakdownKind, ClaudeUsageSnapshot } from '../../shared/claude-usage-types'
import type {
  OpenCodeUsageBreakdownKind,
  OpenCodeUsageSnapshot
} from '../../shared/opencode-usage-types'
import type { RateLimitRuntimeTarget, RateLimitState } from '../../shared/rate-limit-types'

export type UsageProviderSnapshot = {
  scanState: unknown
  summary: { scope: string; range: string }
  daily: unknown[]
  modelBreakdown: unknown[]
  recentSessions: unknown[]
}

export type UsageQueryArgs<Snapshot extends UsageProviderSnapshot> = Pick<
  Snapshot['summary'],
  'scope' | 'range'
>

export type UsageProviderApi<Snapshot extends UsageProviderSnapshot, BreakdownKind> = {
  getScanState: () => Promise<Snapshot['scanState']>
  setEnabled: (args: { enabled: boolean }) => Promise<Snapshot['scanState']>
  refresh: (args?: { force?: boolean }) => Promise<Snapshot['scanState']>
  getSnapshot: (args: UsageQueryArgs<Snapshot> & { limit?: number }) => Promise<Snapshot>
  getSummary: (args: UsageQueryArgs<Snapshot>) => Promise<Snapshot['summary']>
  getDaily: (args: UsageQueryArgs<Snapshot>) => Promise<Snapshot['daily']>
  getBreakdown: (
    args: UsageQueryArgs<Snapshot> & { kind: BreakdownKind }
  ) => Promise<Snapshot['modelBreakdown']>
  getRecentSessions: (
    args: UsageQueryArgs<Snapshot> & { limit?: number }
  ) => Promise<Snapshot['recentSessions']>
}

export type ClaudeUsageApi = UsageProviderApi<ClaudeUsageSnapshot, ClaudeUsageBreakdownKind>

export type OpenCodeUsageApi = UsageProviderApi<OpenCodeUsageSnapshot, OpenCodeUsageBreakdownKind>

export type RateLimitsApi = {
  get: () => Promise<RateLimitState>
  refresh: () => Promise<RateLimitState>
  refreshClaudeForTarget: (target: RateLimitRuntimeTarget) => Promise<RateLimitState>
  setPollingInterval: (ms: number) => Promise<void>
  fetchInactiveClaudeAccounts: () => Promise<void>
  refreshMiniMax: () => Promise<RateLimitState>
  onUpdate: (callback: (state: RateLimitState) => void) => () => void
}
