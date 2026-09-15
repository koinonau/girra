import type { ClaudeAccountService } from '../claude-accounts/service'
import type { RateLimitService } from '../rate-limits/service'
import type { ClaudeRateLimitAccountsState } from '../../shared/managed-account-types'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'

export type RuntimeAccountServices = {
  claudeAccounts: ClaudeAccountService
  rateLimits: RateLimitService
}

export type AccountsSnapshot = {
  claude: ClaudeRateLimitAccountsState
  rateLimits: RateLimitState
}

export class RuntimeAccountController {
  private services: RuntimeAccountServices | null = null
  private commitMessageAgentEnvironment: CommitMessageAgentEnvironmentResolvers | null = null

  setServices(services: RuntimeAccountServices): void {
    this.services = services
  }

  setCommitMessageAgentEnvironment(resolvers: CommitMessageAgentEnvironmentResolvers): void {
    this.commitMessageAgentEnvironment = resolvers
  }

  getCommitMessageAgentEnvironment(): CommitMessageAgentEnvironmentResolvers | undefined {
    return this.commitMessageAgentEnvironment ?? undefined
  }

  getClaudeConfigDirectory(target: ClaudeAccountSelectionTarget): string | null {
    return this.services?.claudeAccounts.getRuntimeConfigDir(target) ?? null
  }

  getSnapshot(): AccountsSnapshot {
    const { claudeAccounts, rateLimits } = this.requireServices()
    return {
      claude: claudeAccounts.listAccounts(),
      rateLimits: rateLimits.getState()
    }
  }

  async refreshForMobile(): Promise<void> {
    const { rateLimits } = this.requireServices()
    await Promise.allSettled([rateLimits.refresh(), rateLimits.fetchInactiveClaudeAccountsOnOpen()])
  }

  async refreshForMobileSubscriber(): Promise<void> {
    const { rateLimits } = this.requireServices()
    await Promise.allSettled([
      rateLimits.refreshIfStale(),
      rateLimits.fetchInactiveClaudeAccountsOnOpen()
    ])
  }

  selectClaude(accountId: string | null): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.selectAccount(accountId)
  }

  removeClaude(accountId: string): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.removeAccount(accountId)
  }

  addClaudeFromConfigDir(
    configDir: string,
    options?: {
      runtime?: 'host' | 'wsl'
      wslDistro?: string | null
      previousLegacyCredentialsSha256?: string | null
    }
  ): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.addAccountFromConfigDir(configDir, options)
  }

  onChanged(listener: (snapshot: AccountsSnapshot) => void): () => void {
    const services = this.requireServices()
    return services.rateLimits.onStateChange((rateLimits) => {
      listener({
        claude: services.claudeAccounts.listAccounts(),
        rateLimits
      })
    })
  }

  private requireServices(): RuntimeAccountServices {
    if (!this.services) {
      throw new Error('Account services are not configured on this runtime')
    }
    return this.services
  }
}
