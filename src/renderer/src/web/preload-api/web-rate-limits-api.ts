import type { PreloadApi } from '../../../../preload/api-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { noopUnsubscribe } from './web-storage'

export function createRateLimitsApi(): NonNullable<Partial<PreloadApi>['rateLimits']> {
  const empty = createEmptyRateLimitState()
  return {
    get: () => Promise.resolve(empty),
    refresh: () => Promise.resolve(empty),
    refreshClaudeForTarget: () => Promise.resolve(empty),
    setPollingInterval: () => Promise.resolve(),
    fetchInactiveClaudeAccounts: () => Promise.resolve(),
    refreshMiniMax: () => Promise.resolve(empty),
    onUpdate: () => noopUnsubscribe
  }
}
