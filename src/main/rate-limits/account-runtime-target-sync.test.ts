import { describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../shared/constants'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { createAccountRuntimeTargetSettingsSync } from './account-runtime-target-sync'

function createServiceTargets(claudeTarget: RateLimitState['claudeTarget']) {
  const state = { claudeTarget } as RateLimitState
  return {
    getState: vi.fn(() => state),
    refreshClaudeForTarget: vi.fn(async () => state)
  }
}

describe('createAccountRuntimeTargetSettingsSync', () => {
  it('retargets Claude when auto changes to WSL', async () => {
    const service = createServiceTargets({ runtime: 'host', wslDistro: null })
    const settings = {
      ...getDefaultSettings('/tmp'),
      localAccountRuntime: 'auto' as const,
      localWindowsRuntimeDefault: { kind: 'wsl' as const, distro: 'Ubuntu' }
    }
    const syncSettings = createAccountRuntimeTargetSettingsSync(
      service,
      getDefaultSettings('/tmp'),
      'win32'
    )

    await syncSettings(
      { localWindowsRuntimeDefault: settings.localWindowsRuntimeDefault },
      settings
    )

    expect(service.refreshClaudeForTarget).toHaveBeenCalledOnce()
    expect(service.refreshClaudeForTarget).toHaveBeenCalledWith({
      runtime: 'wsl',
      wslDistro: 'Ubuntu'
    })
  })

  it('does no work for unrelated settings updates', async () => {
    const service = createServiceTargets({ runtime: 'host', wslDistro: null })
    const settings = getDefaultSettings('/tmp')
    const syncSettings = createAccountRuntimeTargetSettingsSync(service, settings, 'win32')

    await syncSettings({ theme: 'dark' }, settings)

    expect(service.getState).not.toHaveBeenCalled()
    expect(service.refreshClaudeForTarget).not.toHaveBeenCalled()
  })

  it('preserves a manual runtime when the settings-derived policy does not change', async () => {
    const service = createServiceTargets({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    const initialSettings = {
      ...getDefaultSettings('/tmp'),
      localAccountRuntime: 'host' as const
    }
    const settings = {
      ...initialSettings,
      localWindowsRuntimeDefault: { kind: 'wsl' as const, distro: 'Ubuntu' }
    }
    const syncSettings = createAccountRuntimeTargetSettingsSync(service, initialSettings, 'win32')

    await syncSettings(
      { localWindowsRuntimeDefault: settings.localWindowsRuntimeDefault },
      settings
    )

    expect(service.getState).not.toHaveBeenCalled()
    expect(service.refreshClaudeForTarget).not.toHaveBeenCalled()
  })

  it('refreshes Claude back to host when the policy leaves WSL', async () => {
    const service = createServiceTargets({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    const initialSettings = {
      ...getDefaultSettings('/tmp'),
      localWindowsRuntimeDefault: { kind: 'wsl' as const, distro: 'Ubuntu' }
    }
    const settings = getDefaultSettings('/tmp')
    const syncSettings = createAccountRuntimeTargetSettingsSync(service, initialSettings, 'win32')

    await syncSettings(
      { localWindowsRuntimeDefault: settings.localWindowsRuntimeDefault },
      settings
    )

    expect(service.refreshClaudeForTarget).toHaveBeenCalledOnce()
    expect(service.refreshClaudeForTarget).toHaveBeenCalledWith({ runtime: 'host' })
  })

  it('skips the refresh when the service already uses the new target', async () => {
    const service = createServiceTargets({ runtime: 'host', wslDistro: null })
    const initialSettings = {
      ...getDefaultSettings('/tmp'),
      localWindowsRuntimeDefault: { kind: 'wsl' as const, distro: 'Ubuntu' }
    }
    const settings = getDefaultSettings('/tmp')
    const syncSettings = createAccountRuntimeTargetSettingsSync(service, initialSettings, 'win32')

    await syncSettings(
      { localWindowsRuntimeDefault: settings.localWindowsRuntimeDefault },
      settings
    )

    expect(service.getState).toHaveBeenCalledOnce()
    expect(service.refreshClaudeForTarget).not.toHaveBeenCalled()
  })
})
