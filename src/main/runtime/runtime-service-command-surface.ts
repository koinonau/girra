import type { RuntimeAccountController } from './runtime-account-controller'
import type { RuntimeAiVaultCommands } from './runtime-ai-vault-commands'
import type { RuntimeClientEventBus } from './runtime-client-event-bus'
import type { RuntimeMessageWaiters } from './runtime-message-waiters'
import type { RuntimeSubscriptionRegistry } from './runtime-subscription-registry'

export type RuntimeServiceCommandSurface = {
  listAiVaultSessions: RuntimeAiVaultCommands['list']
  resolveAiVaultSessionTitles: RuntimeAiVaultCommands['resolveTitles']
  onClientEvent: RuntimeClientEventBus['on']
  registerSubscriptionCleanup: RuntimeSubscriptionRegistry['register']
  registerOwnedSubscriptionCleanup: RuntimeSubscriptionRegistry['registerOwned']
  cleanupSubscription: RuntimeSubscriptionRegistry['cleanup']
  retrySubscriptionCleanupAfter: RuntimeSubscriptionRegistry['retryAfter']
  cleanupSubscriptionAndWait: RuntimeSubscriptionRegistry['cleanupAndWait']
  cleanupSubscriptionsByPrefix: RuntimeSubscriptionRegistry['cleanupByPrefix']
  cleanupSubscriptionsForConnection: RuntimeSubscriptionRegistry['cleanupForConnection']
  cleanupSubscriptionIfOwnedByConnection: RuntimeSubscriptionRegistry['cleanupIfOwnedByConnection']
  setAccountServices: RuntimeAccountController['setServices']
  setCommitMessageAgentEnvironmentResolvers: RuntimeAccountController['setCommitMessageAgentEnvironment']
  getCommitMessageAgentEnvironmentResolvers: RuntimeAccountController['getCommitMessageAgentEnvironment']
  getAccountsSnapshot: RuntimeAccountController['getSnapshot']
  refreshAccountsForMobile: RuntimeAccountController['refreshForMobile']
  refreshAccountsForMobileSubscriber: RuntimeAccountController['refreshForMobileSubscriber']
  selectClaudeAccount: RuntimeAccountController['selectClaude']
  removeClaudeAccount: RuntimeAccountController['removeClaude']
  addClaudeAccountFromConfigDir: RuntimeAccountController['addClaudeFromConfigDir']
  onAccountsChanged: RuntimeAccountController['onChanged']
  notifyMessageArrived(handle: string, messageType?: string): void
  waitForMessage: RuntimeMessageWaiters['wait']
  cancelMessageWaiters: RuntimeMessageWaiters['cancel']
}

type RuntimeServiceCommandOwners = {
  aiVault: RuntimeAiVaultCommands
  clientEvents: RuntimeClientEventBus
  subscriptions: RuntimeSubscriptionRegistry
  accounts: RuntimeAccountController
  messageWaiters: RuntimeMessageWaiters
}

export function installRuntimeServiceCommandSurface(
  target: RuntimeServiceCommandSurface,
  owners: RuntimeServiceCommandOwners
): void {
  const vault = owners.aiVault
  const events = owners.clientEvents
  const subscriptions = owners.subscriptions
  const accounts = owners.accounts
  const waiters = owners.messageWaiters
  Object.assign(target, {
    listAiVaultSessions: vault.list.bind(vault),
    resolveAiVaultSessionTitles: vault.resolveTitles.bind(vault),
    onClientEvent: events.on.bind(events),
    registerSubscriptionCleanup: subscriptions.register.bind(subscriptions),
    registerOwnedSubscriptionCleanup: subscriptions.registerOwned.bind(subscriptions),
    cleanupSubscription: subscriptions.cleanup.bind(subscriptions),
    retrySubscriptionCleanupAfter: subscriptions.retryAfter.bind(subscriptions),
    cleanupSubscriptionAndWait: subscriptions.cleanupAndWait.bind(subscriptions),
    cleanupSubscriptionsByPrefix: subscriptions.cleanupByPrefix.bind(subscriptions),
    cleanupSubscriptionsForConnection: subscriptions.cleanupForConnection.bind(subscriptions),
    cleanupSubscriptionIfOwnedByConnection:
      subscriptions.cleanupIfOwnedByConnection.bind(subscriptions),
    setAccountServices: accounts.setServices.bind(accounts),
    setCommitMessageAgentEnvironmentResolvers:
      accounts.setCommitMessageAgentEnvironment.bind(accounts),
    getCommitMessageAgentEnvironmentResolvers:
      accounts.getCommitMessageAgentEnvironment.bind(accounts),
    getAccountsSnapshot: accounts.getSnapshot.bind(accounts),
    refreshAccountsForMobile: accounts.refreshForMobile.bind(accounts),
    refreshAccountsForMobileSubscriber: accounts.refreshForMobileSubscriber.bind(accounts),
    selectClaudeAccount: accounts.selectClaude.bind(accounts),
    removeClaudeAccount: accounts.removeClaude.bind(accounts),
    addClaudeAccountFromConfigDir: accounts.addClaudeFromConfigDir.bind(accounts),
    onAccountsChanged: accounts.onChanged.bind(accounts),
    waitForMessage: waiters.wait.bind(waiters),
    cancelMessageWaiters: waiters.cancel.bind(waiters)
  })
}
