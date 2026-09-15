import type { Dispatch, SetStateAction } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { FeatureInteractionId } from '../../../../shared/feature-interaction-catalog'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getProviderAccountActiveIdForView } from './provider-account-visibility'
import type {
  ClaudeAccountAction,
  ClaudeAccountActionRunner,
  LocalAccountRuntime
} from './accounts-pane-types'
import {
  getClaudeAccountErrorDescription,
  isClaudeAccountCancellation
} from './accounts-pane-action-errors'
import { getClaudeAccountLabel } from './accounts-pane-runtime'

type ClaudeActionContext = {
  settings: GlobalSettings
  accountRuntime: LocalAccountRuntime
  isRemoteAccountScope: boolean
  claudeAccounts: ClaudeRateLimitAccountsState
  setClaudeAccounts: Dispatch<SetStateAction<ClaudeRateLimitAccountsState>>
  setClaudeAction: Dispatch<SetStateAction<ClaudeAccountAction>>
  fetchSettings: () => Promise<void>
  recordFeatureInteraction: (featureId: FeatureInteractionId) => void
}

export function createClaudeAccountActionRunner(
  context: ClaudeActionContext
): ClaudeAccountActionRunner {
  const {
    accountRuntime,
    claudeAccounts,
    fetchSettings,
    isRemoteAccountScope,
    recordFeatureInteraction,
    setClaudeAccounts,
    setClaudeAction
  } = context
  const syncClaudeAccounts = async (next: ClaudeRateLimitAccountsState): Promise<void> => {
    setClaudeAccounts(next)
    if (!isRemoteAccountScope) {
      await fetchSettings()
    }
  }

  return async (action, operation, actionRuntime = accountRuntime): Promise<void> => {
    const previousActiveAccountId = getProviderAccountActiveIdForView(claudeAccounts, actionRuntime)
    setClaudeAction(action)
    try {
      const next = await operation()
      await syncClaudeAccounts(next)
      recordFeatureInteraction('claude-account-switching')
      const nextActiveAccountId = getProviderAccountActiveIdForView(next, actionRuntime)
      const shouldPromptRestart =
        action === 'adding' ||
        previousActiveAccountId !== nextActiveAccountId ||
        (action.startsWith('reauth:') &&
          nextActiveAccountId !== null &&
          action === `reauth:${nextActiveAccountId}`)
      if (shouldPromptRestart) {
        toast.info(
          translate('auto.components.settings.AccountsPane.f921d32606', 'Claude account updated.'),
          {
            description: translate(
              'auto.components.settings.AccountsPane.b15ce90870',
              '{{value0}} -> {{value1}}. Restart live Claude terminals before continuing old sessions.',
              {
                value0: getClaudeAccountLabel(claudeAccounts, previousActiveAccountId),
                value1: getClaudeAccountLabel(next, nextActiveAccountId)
              }
            )
          }
        )
      }
    } catch (error) {
      if (isClaudeAccountCancellation(error)) {
        return
      }
      toast.error(
        translate(
          'auto.components.settings.AccountsPane.2743cdc0af',
          'Claude account update failed.'
        ),
        {
          description: getClaudeAccountErrorDescription(error)
        }
      )
    } finally {
      setClaudeAction('idle')
    }
  }
}
