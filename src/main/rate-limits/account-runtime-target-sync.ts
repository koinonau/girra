import type { GlobalSettings } from '../../shared/global-settings-types'
import type { RateLimitService } from './service'
import { getInitialClaudeRateLimitTarget } from './claude-rate-limit-target'

type AccountRuntimeRateLimitService = Pick<RateLimitService, 'getState' | 'refreshClaudeForTarget'>

type RuntimeTarget = {
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
}

export function createAccountRuntimeTargetSettingsSync(
  rateLimits: AccountRuntimeRateLimitService,
  initialSettings: GlobalSettings,
  platform: NodeJS.Platform = process.platform
): (updates: Partial<GlobalSettings>, settings: GlobalSettings) => Promise<void> {
  let settingsTarget = getInitialClaudeRateLimitTarget(initialSettings, platform)

  return async (updates, settings): Promise<void> => {
    if (!containsAccountRuntimeTargetUpdate(updates)) {
      return
    }

    const nextSettingsTarget = getInitialClaudeRateLimitTarget(settings, platform)
    const policyChanged = !isSameTarget(settingsTarget, nextSettingsTarget)
    settingsTarget = nextSettingsTarget
    if (!policyChanged) {
      return
    }

    if (!isSameTarget(rateLimits.getState().claudeTarget, nextSettingsTarget)) {
      await rateLimits.refreshClaudeForTarget(nextSettingsTarget)
    }
  }
}

function containsAccountRuntimeTargetUpdate(updates: Partial<GlobalSettings>): boolean {
  return (
    'localAccountRuntime' in updates ||
    'localAccountWslDistro' in updates ||
    'localWindowsRuntimeDefault' in updates
  )
}

function isSameTarget(current: RuntimeTarget, next: RuntimeTarget): boolean {
  return (
    (current.runtime ?? 'host') === (next.runtime ?? 'host') &&
    (current.wslDistro ?? null) === (next.wslDistro ?? null)
  )
}
