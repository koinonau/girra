import { RateLimitServiceInactiveAccounts } from './service-inactive-accounts'
import {
  normalizeClaudeAccountSelectionTarget,
  type ClaudeAccountSelectionTarget,
  type RateLimitState
} from './service-types'

export abstract class RateLimitServiceAccountRefresh extends RateLimitServiceInactiveAccounts {
  async refresh(): Promise<RateLimitState> {
    // Why: this user-directed refresh must bypass the poll throttle, else the click can no-op after wake/focus and feel broken.
    await this.fetchAll({ force: true })
    return this.getState()
  }

  async refreshIfStale(): Promise<RateLimitState> {
    // Why: reconnecting mobile subscribers need fresh backgrounded-desktop data, but replaying a subscription must not queue another forced fetch.
    const plan = this.getActiveWindowRefreshPlan(Date.now())
    await this.runActiveWindowRefreshPlan(plan)
    return this.getState()
  }

  invalidateMiniMaxCredentialState(): void {
    this.minimaxFetchGeneration += 1
    // Why: saving/forgetting the cookie can race an in-flight fetch; clear the visible snapshot before any old-cookie result returns.
    this.updateState({
      ...this.state,
      minimax: this.withFetchingStatus(null, 'minimax')
    })
  }

  async refreshForClaudeAccountChange(
    outgoingAccountId?: string | null,
    target?: ClaudeAccountSelectionTarget
  ): Promise<RateLimitState> {
    const nextTarget = normalizeClaudeAccountSelectionTarget(target)
    // Why: snapshot the outgoing account's usage before clearing so the switcher's inline bars can show last-known data immediately.
    if (
      outgoingAccountId &&
      this.state.claude?.session &&
      this.isSameClaudeTarget(this.claudeFetchTarget, nextTarget)
    ) {
      this.inactiveClaudeCache.set(outgoingAccountId, this.state.claude)
    }
    this.claudeFetchTarget = nextTarget
    this.inactiveClaudeAccountsGeneration += 1
    this.pruneInactiveClaudeState()
    this.claudeFetchGeneration += 1
    // Why: a new account/target starts with a clean retry schedule.
    this.activeFailureStreakByProvider.claude = 0
    // Why: statusline posts from the outgoing account's sessions must not land on the incoming account's bar mid-switch.
    this.lastClaudeAuthSnapshot = null
    this.lastInactiveClaudeFetchAt = 0
    this.updateState({
      ...this.state,
      claude: this.withFetchingStatus(null, 'claude')
    })
    await this.fetchClaudeOnly({ force: true })
    return this.getState()
  }

  async refreshClaudeForTarget(target?: ClaudeAccountSelectionTarget): Promise<RateLimitState> {
    const nextTarget = normalizeClaudeAccountSelectionTarget(target)
    const targetChanged = !this.isSameClaudeTarget(this.claudeFetchTarget, nextTarget)
    this.claudeFetchTarget = nextTarget
    this.claudeFetchGeneration += 1
    this.activeFailureStreakByProvider.claude = 0
    if (targetChanged) {
      // Why: statusline posts from the outgoing target's sessions must not land on the incoming target's bar mid-switch.
      this.lastClaudeAuthSnapshot = null
    }
    this.updateState({
      ...this.state,
      claude: this.withFetchingStatus(targetChanged ? null : this.state.claude, 'claude')
    })
    await this.fetchClaudeOnly({ force: true })
    return this.getState()
  }

  async refreshAfterClaudeLivePtysDrained(): Promise<void> {
    // Why: "Waiting for Claude session" can only recover once no live claude
    // owns the credentials. Refetch on the last PTY exit instead of leaving
    // the stale terminal error up until the failure backoff elapses.
    if (!this.state.claude?.usageMetadata?.deferredByLiveClaudeSession) {
      return
    }
    this.activeFailureStreakByProvider.claude = 0
    await this.fetchClaudeOnly({ force: true })
  }
}
