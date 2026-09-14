import { describe, expect, it } from 'vitest'
import type {
  ProviderRateLimits,
  ProviderRateLimitStatus
} from '../../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import {
  getVisibleUsageProvider,
  hasUsageProviderSettings,
  hasUsageProviderSettingsForProvider,
  isUsageEmptyState,
  isProviderConfigured,
  type UsageProviderSettings
} from './status-bar-provider-visibility'

function provider(
  status: ProviderRateLimitStatus,
  overrides: Partial<ProviderRateLimits> = {}
): ProviderRateLimits {
  return {
    provider: 'opencode-go',
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status,
    ...overrides
  }
}

describe('isProviderConfigured', () => {
  it('hides a provider whose state has not loaded yet', () => {
    expect(isProviderConfigured(null)).toBe(false)
    expect(isProviderConfigured(undefined)).toBe(false)
  })

  it('hides an unconfigured (unavailable) provider', () => {
    // The bug: an unset OpenCode Go cookie returns a non-null
    // `unavailable` object, which previously slipped past the `!== null` gate
    // and rendered a "--" bar for a provider the user never configured.
    expect(isProviderConfigured(provider('unavailable'))).toBe(false)
  })

  it('hides a first-load fetching provider until it has proven usage data', () => {
    // The initial fetch marks every provider as `fetching`; without prior data
    // that state is not proof the user configured OpenCode Go.
    expect(isProviderConfigured(provider('fetching'))).toBe(false)
  })

  it('shows configured providers, including ones failing transiently', () => {
    expect(isProviderConfigured(provider('ok'))).toBe(true)
    expect(isProviderConfigured(provider('error'))).toBe(true)
    expect(
      isProviderConfigured(
        provider('fetching', {
          session: {
            usedPercent: 25,
            windowMinutes: 300,
            resetsAt: null,
            resetDescription: null
          }
        })
      )
    ).toBe(true)
    expect(isProviderConfigured(provider('idle'))).toBe(true)
  })
})

function usageSettings(overrides: Partial<UsageProviderSettings> = {}): UsageProviderSettings {
  return {
    codexManagedAccounts: [],
    claudeManagedAccounts: [],
    opencodeSessionCookie: '',
    minimaxCookieConfigured: false,
    minimaxApiKeyConfigured: false,
    ...overrides
  }
}

describe('hasUsageProviderSettings', () => {
  it('treats persisted managed accounts as configured usage providers', () => {
    expect(
      hasUsageProviderSettings(
        usageSettings({
          codexManagedAccounts: [
            {
              id: 'codex-account-1',
              email: 'dev@example.com',
              managedHomePath: '/tmp/codex-account-1',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
      )
    ).toBe(true)

    expect(
      hasUsageProviderSettings(
        usageSettings({
          claudeManagedAccounts: [
            {
              id: 'claude-account-1',
              email: 'dev@example.com',
              managedAuthPath: '/tmp/claude-account-1',
              authMethod: 'subscription-oauth',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
      )
    ).toBe(true)
  })

  it('treats explicit non-managed provider settings as configured usage providers', () => {
    expect(
      hasUsageProviderSettings(usageSettings({ opencodeSessionCookie: ' session=abc ' }))
    ).toBe(true)
    expect(hasUsageProviderSettings(usageSettings({ minimaxCookieConfigured: true }))).toBe(true)
    expect(hasUsageProviderSettings(usageSettings({ minimaxApiKeyConfigured: true }))).toBe(true)
  })

  it('does not treat empty or unloaded settings as configured', () => {
    expect(hasUsageProviderSettings(usageSettings())).toBe(false)
    expect(hasUsageProviderSettings(null)).toBe(false)
  })
})

describe('hasUsageProviderSettingsForProvider', () => {
  it('checks durable configuration for a single provider', () => {
    expect(
      hasUsageProviderSettingsForProvider(
        'codex',
        usageSettings({
          codexManagedAccounts: [
            {
              id: 'codex-account-1',
              email: 'dev@example.com',
              managedHomePath: '/tmp/codex-account-1',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
      )
    ).toBe(true)
    expect(hasUsageProviderSettingsForProvider('claude', usageSettings())).toBe(false)
    expect(hasUsageProviderSettingsForProvider('opencode-go', usageSettings())).toBe(false)
  })

  it('treats minimaxCookieConfigured as the durable signal for MiniMax', () => {
    expect(
      hasUsageProviderSettingsForProvider(
        'minimax',
        usageSettings({ minimaxCookieConfigured: true })
      )
    ).toBe(true)
    expect(hasUsageProviderSettingsForProvider('minimax', usageSettings())).toBe(false)
    expect(hasUsageProviderSettingsForProvider('minimax', null)).toBe(false)
  })

  it('treats minimaxApiKeyConfigured as a parallel durable signal for MiniMax', () => {
    // Why: CN endpoint users can configure MiniMax with an API key only. The
    // visibility check must accept either credential so the status bar stays
    // visible while the snapshot is still pending.
    expect(
      hasUsageProviderSettingsForProvider(
        'minimax',
        usageSettings({ minimaxApiKeyConfigured: true })
      )
    ).toBe(true)
    expect(
      hasUsageProviderSettingsForProvider(
        'minimax',
        usageSettings({ minimaxApiKeyConfigured: false, minimaxCookieConfigured: false })
      )
    ).toBe(false)
  })
})

describe('getVisibleUsageProvider', () => {
  it('keeps configured managed-account providers visible while snapshots are pending', () => {
    const visible = getVisibleUsageProvider(
      'codex',
      null,
      usageSettings({
        codexManagedAccounts: [
          {
            id: 'codex-account-1',
            email: 'dev@example.com',
            managedHomePath: '/tmp/codex-account-1',
            createdAt: 1,
            updatedAt: 1,
            lastAuthenticatedAt: 1
          }
        ]
      })
    )

    expect(visible).toMatchObject({
      provider: 'codex',
      status: 'fetching',
      session: null,
      weekly: null
    })
  })

  it('keeps configured providers visible when a fetch returns unavailable', () => {
    const unavailable = provider('unavailable', {
      provider: 'claude',
      error: 'Claude OAuth access token unavailable'
    })

    expect(
      getVisibleUsageProvider(
        'claude',
        unavailable,
        usageSettings({
          claudeManagedAccounts: [
            {
              id: 'claude-account-1',
              email: 'dev@example.com',
              managedAuthPath: '/tmp/claude-account-1',
              authMethod: 'subscription-oauth',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
      )
    ).toBe(unavailable)
  })

  it('hides providers with no live data or durable configuration', () => {
    expect(getVisibleUsageProvider('codex', null, usageSettings())).toBe(null)
    expect(getVisibleUsageProvider('minimax', undefined, usageSettings())).toBe(null)
    expect(getVisibleUsageProvider('opencode-go', provider('fetching'), usageSettings())).toBe(null)
  })

  it('creates a pending snapshot when an older main process omits a configured provider', () => {
    expect(
      getVisibleUsageProvider(
        'minimax',
        undefined,
        usageSettings({ minimaxApiKeyConfigured: true })
      )
    ).toMatchObject({ provider: 'minimax', status: 'fetching' })
  })

  it('keeps MiniMax visible while the snapshot is pending when a cookie is configured', () => {
    const visible = getVisibleUsageProvider(
      'minimax',
      null,
      usageSettings({ minimaxCookieConfigured: true })
    )
    expect(visible).toMatchObject({
      provider: 'minimax',
      status: 'fetching',
      session: null,
      weekly: null
    })
  })

  it('keeps MiniMax visible when the fetch returns unavailable for a configured cookie', () => {
    const unavailable = provider('unavailable', {
      provider: 'minimax',
      error: 'MiniMax session expired. Replace the MiniMax cookie in Settings.'
    })
    expect(
      getVisibleUsageProvider(
        'minimax',
        unavailable,
        usageSettings({ minimaxCookieConfigured: true })
      )
    ).toBe(unavailable)
  })

  it('hides MiniMax when no cookie is configured and the snapshot is empty', () => {
    expect(getVisibleUsageProvider('minimax', null, usageSettings())).toBe(null)
    expect(
      getVisibleUsageProvider(
        'minimax',
        provider('unavailable', { provider: 'minimax' }),
        usageSettings()
      )
    ).toBe(null)
  })
})

describe('isUsageEmptyState', () => {
  it('waits for provider snapshots before showing the setup CTA', () => {
    expect(isUsageEmptyState(createEmptyRateLimitState(), usageSettings())).toBe(false)
  })

  it('treats provider keys omitted by an older main process as pending', () => {
    expect(
      isUsageEmptyState(
        {
          claude: provider('unavailable', { provider: 'claude' }),
          codex: provider('unavailable', { provider: 'codex' }),
          opencodeGo: provider('unavailable', { provider: 'opencode-go' }),
          minimax: undefined
        },
        usageSettings()
      )
    ).toBe(false)
  })

  it('does not show the setup CTA while system-default usage snapshots are fetching', () => {
    expect(
      isUsageEmptyState(
        {
          claude: provider('fetching', { provider: 'claude' }),
          codex: provider('fetching', { provider: 'codex' }),
          opencodeGo: provider('unavailable', { provider: 'opencode-go' }),
          minimax: provider('unavailable', { provider: 'minimax' })
        },
        usageSettings()
      )
    ).toBe(false)
  })

  it('does not show the setup CTA when persisted accounts exist but snapshots have no usage data', () => {
    expect(
      isUsageEmptyState(
        {
          claude: provider('unavailable', { provider: 'claude' }),
          codex: provider('unavailable', { provider: 'codex' }),
          opencodeGo: provider('unavailable', { provider: 'opencode-go' }),
          minimax: provider('unavailable', { provider: 'minimax' })
        },
        usageSettings({
          codexManagedAccounts: [
            {
              id: 'codex-account-1',
              email: 'dev@example.com',
              managedHomePath: '/tmp/codex-account-1',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
      )
    ).toBe(false)
  })

  it('waits for settings before showing the setup CTA', () => {
    expect(isUsageEmptyState(createEmptyRateLimitState(), null)).toBe(false)
  })

  it('shows the setup CTA for a loaded profile with no configured usage provider', () => {
    expect(
      isUsageEmptyState(
        {
          claude: provider('unavailable', { provider: 'claude' }),
          codex: provider('unavailable', { provider: 'codex' }),
          opencodeGo: provider('unavailable', { provider: 'opencode-go' }),
          minimax: provider('unavailable', { provider: 'minimax' })
        },
        usageSettings()
      )
    ).toBe(true)
  })
})
