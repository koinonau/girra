import { useEffect, useRef, useState } from 'react'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import { toast } from 'sonner'
import { useAppStore } from '../../store'
import { translate } from '@/i18n/i18n'
import { isWebClientLocation } from '@/lib/web-client-location'
import {
  emptyClaudeAccountsState,
  hasRemoteProviderAccountOwner,
  watchProviderAccounts
} from '@/runtime/runtime-provider-accounts-client'
import {
  getAccountsClaudeSearchEntries,
  getAccountsLocationSearchEntries,
  getAccountsMiniMaxSearchEntries,
  getAccountsOpencodeSearchEntries,
  getAccountsPaneSearchEntries
} from './accounts-search'
import { getRemoteAccountsPaneScope } from './provider-account-scope'
import { ProviderHostScopeControl } from './ProviderHostScopeControl'
import { matchesSettingsSearch } from './settings-search'
import {
  providerAccountIsActiveInView,
  providerAccountMatchesView
} from './provider-account-visibility'
import { Separator } from '../ui/separator'
import type {
  AccountsPaneProps,
  AccountsPaneSectionModel,
  ClaudeAccountAction,
  RemoveAccountTarget
} from './accounts-pane-types'
import { EMPTY_WSL_DISTROS, getSelectedAccountRuntime } from './accounts-pane-runtime'
import { createClaudeAccountActionRunner } from './accounts-pane-account-actions'
import { createMiniMaxCredentialActions } from './accounts-pane-minimax-actions'
import { renderAccountsLocationSection } from './accounts-pane-location-section'
import { renderClaudeAccountsSection } from './accounts-pane-claude-section'
import { renderOpenCodeAccountsSection } from './accounts-pane-provider-setting-sections'
import { renderMiniMaxAccountsSection } from './accounts-pane-minimax-section'
import { renderAccountsRemovalDialogs } from './accounts-pane-removal-dialogs'

export { getAccountsPaneSearchEntries }

export function AccountsPane({
  settings,
  updateSettings,
  wslSupportedPlatform = false,
  wslAvailable = false,
  wslDistros = EMPTY_WSL_DISTROS,
  wslCapabilitiesLoading = false,
  accountOwnerPlatform = null
}: AccountsPaneProps): React.JSX.Element {
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const miniMaxRateLimits = useAppStore((s) => s.rateLimits.minimax)
  const recordFeatureInteraction = useAppStore((s) => s.recordFeatureInteraction)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const recordedOpenCodeSettingEditsRef = useRef<Set<'cookie' | 'workspaceId'>>(new Set())
  const [miniMaxCookieDraft, setMiniMaxCookieDraft] = useState('')
  const [miniMaxApiKeyDraft, setMiniMaxApiKeyDraft] = useState('')
  const [miniMaxApiKeyConfigured, setMiniMaxApiKeyConfigured] = useState(false)
  const [miniMaxConfigured, setMiniMaxConfigured] = useState(false)
  const [miniMaxCredentialBusy, setMiniMaxCredentialBusy] = useState(false)
  const localAccountRuntime = getSelectedAccountRuntime(
    settings,
    wslSupportedPlatform,
    wslAvailable,
    wslDistros,
    wslCapabilitiesLoading
  )
  // Why: with a Remote Girra Server active the server owns provider accounts
  // (see #7973); every list/select/remove below must scope to it, not host/WSL.
  const isRemoteAccountScope = hasRemoteProviderAccountOwner(settings)
  const activeRuntimeEnvironmentId = settings.activeRuntimeEnvironmentId?.trim() || null
  // Why: keep the real name separate from the prose fallback below; the scope
  // label must not interpolate the fallback.
  const remoteServerName = isRemoteAccountScope
    ? (runtimeEnvironments.find((environment) => environment.id === activeRuntimeEnvironmentId)
        ?.name ?? null)
    : null
  const remoteServerLabel = isRemoteAccountScope
    ? (remoteServerName ??
      translate('auto.components.settings.AccountsPane.remoteServerFallback', 'the remote server'))
    : null
  const accountRuntime = isRemoteAccountScope
    ? { runtime: 'host' as const, label: remoteServerLabel ?? '' }
    : localAccountRuntime
  // Why: host runtime labels are standalone UI labels; interpolated prose needs sentence casing.
  const accountRuntimeSentenceLabel =
    !isRemoteAccountScope &&
    accountRuntime.runtime === 'host' &&
    !navigator.userAgent.includes('Windows')
      ? `${accountRuntime.label.charAt(0).toLocaleLowerCase()}${accountRuntime.label.slice(1)}`
      : accountRuntime.label
  // Why: users read the remote-scoped list as their desktop accounts being
  // deleted (#8186); say they are intact and link the default-runtime control.
  // The web client has no desktop-owned accounts and cannot select Local
  // desktop, so promising a switch back would be a dead end there.
  const remoteAccountScopeNotice =
    isRemoteAccountScope && !isWebClientLocation() ? (
      <ProviderHostScopeControl
        labelPrefix={translate(
          'auto.components.settings.AccountsPane.accountScopePrefix',
          'Account scope'
        )}
        scope={getRemoteAccountsPaneScope(remoteServerName)}
        className="text-xs"
      />
    ) : null

  const [claudeAccounts, setClaudeAccounts] =
    useState<ClaudeRateLimitAccountsState>(emptyClaudeAccountsState)
  const [claudeAction, setClaudeAction] = useState<ClaudeAccountAction>('idle')
  // Why: capture the account's runtime slot when the dialog opens; the roster can change underneath it.
  const [removeClaudeTarget, setRemoveClaudeTarget] = useState<RemoveAccountTarget | null>(null)
  const accountVisibilityOptions = {
    remoteOwner: isRemoteAccountScope,
    ownerPlatform: accountOwnerPlatform
  }
  const visibleClaudeAccounts = claudeAccounts.accounts.filter((account) =>
    providerAccountMatchesView(account, accountRuntime, accountVisibilityOptions)
  )
  // Why: System default lights only when no account row is active; while a remote
  // owner's platform is unknown WSL rows hide fail-closed, so check the full roster.
  const ownerPlatformUnknown = isRemoteAccountScope && accountOwnerPlatform === null
  const systemClaudeActive = !(
    ownerPlatformUnknown ? claudeAccounts.accounts : visibleClaudeAccounts
  ).some((account) =>
    providerAccountIsActiveInView(account, claudeAccounts, accountRuntime, accountVisibilityOptions)
  )
  const accountRuntimeUnavailable =
    accountRuntime.runtime === 'wsl' && !wslAvailable && !wslCapabilitiesLoading

  const recordOpenCodeSettingEdit = (field: 'cookie' | 'workspaceId'): void => {
    if (recordedOpenCodeSettingEditsRef.current.has(field)) {
      return
    }
    recordedOpenCodeSettingEditsRef.current.add(field)
    recordFeatureInteraction('usage-tracking')
  }
  const refreshMiniMaxCredentialStatus = async (): Promise<void> => {
    try {
      const status = await window.api.minimaxCredentials.getStatus()
      setMiniMaxConfigured(status.cookieConfigured)
      setMiniMaxApiKeyConfigured(status.apiKeyConfigured)
    } catch (error) {
      console.error('Failed to load MiniMax credential status:', error)
    }
  }
  const { saveMiniMaxCookie, clearMiniMaxCookie, saveMiniMaxApiKey, clearMiniMaxApiKey } =
    createMiniMaxCredentialActions({
      miniMaxCookieDraft,
      setMiniMaxCookieDraft,
      miniMaxApiKeyDraft,
      setMiniMaxApiKeyDraft,
      setMiniMaxApiKeyConfigured,
      setMiniMaxConfigured,
      setMiniMaxCredentialBusy,
      recordFeatureInteraction
    })

  useEffect(() => {
    void refreshMiniMaxCredentialStatus()
  }, [])

  useEffect(() => {
    // Why: remote snapshots stream usage refreshes after the synchronous ready
    // message, so the watcher stays open for the pane's lifetime; the local
    // path resolves once and the close() is a no-op.
    const watcher = watchProviderAccounts(
      { activeRuntimeEnvironmentId },
      {
        onSnapshot: (snapshot) => {
          setClaudeAccounts(snapshot.claude)
        },
        onError: (error) => {
          toast.error(
            translate(
              'auto.components.settings.AccountsPane.loadAccountsFailed',
              'Could not load provider accounts.'
            ),
            { description: String((error as Error)?.message ?? error) }
          )
        }
      }
    )
    return () => {
      watcher.close()
    }
  }, [activeRuntimeEnvironmentId])

  const runClaudeAccountAction = createClaudeAccountActionRunner({
    settings,
    accountRuntime,
    isRemoteAccountScope,
    claudeAccounts,
    setClaudeAccounts,
    setClaudeAction,
    fetchSettings,
    recordFeatureInteraction
  })
  const model: AccountsPaneSectionModel = {
    settings,
    updateSettings,
    searchQuery,
    recordFeatureInteraction,
    wslSupportedPlatform,
    wslAvailable,
    wslDistros,
    wslCapabilitiesLoading,
    localAccountRuntime,
    isRemoteAccountScope,
    remoteServerName,
    remoteAccountScopeNotice,
    accountRuntime,
    accountRuntimeSentenceLabel,
    accountRuntimeUnavailable,
    accountVisibilityOptions,
    claudeAccounts,
    claudeAction,
    visibleClaudeAccounts,
    systemClaudeActive,
    setRemoveClaudeTarget,
    runClaudeAccountAction,
    recordOpenCodeSettingEdit,
    miniMaxRateLimits,
    miniMaxApiKeyDraft,
    setMiniMaxApiKeyDraft,
    miniMaxApiKeyConfigured,
    saveMiniMaxApiKey,
    clearMiniMaxApiKey,
    miniMaxCookieDraft,
    setMiniMaxCookieDraft,
    miniMaxConfigured,
    miniMaxCredentialBusy,
    saveMiniMaxCookie,
    clearMiniMaxCookie
  }
  const visibleSections = [
    wslSupportedPlatform &&
    !isRemoteAccountScope &&
    matchesSettingsSearch(searchQuery, getAccountsLocationSearchEntries())
      ? renderAccountsLocationSection(model)
      : null,
    matchesSettingsSearch(searchQuery, getAccountsClaudeSearchEntries())
      ? renderClaudeAccountsSection(model)
      : null,
    matchesSettingsSearch(searchQuery, getAccountsOpencodeSearchEntries())
      ? renderOpenCodeAccountsSection(model)
      : null,
    matchesSettingsSearch(searchQuery, getAccountsMiniMaxSearchEntries())
      ? renderMiniMaxAccountsSection(model)
      : null
  ].filter(Boolean)

  return (
    <div className="space-y-8">
      {renderAccountsRemovalDialogs(model, removeClaudeTarget)}
      {visibleSections.map((section, index) => (
        <div key={index} className="space-y-8">
          {index > 0 ? <Separator /> : null}
          {section}
        </div>
      ))}
    </div>
  )
}
