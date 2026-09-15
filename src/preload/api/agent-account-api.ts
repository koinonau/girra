import type { ClaudeRateLimitAccountsState } from '../../shared/managed-account-types'

export type ClaudeAccountsApi = {
  list: () => Promise<ClaudeRateLimitAccountsState>
  add: (args?: {
    runtime?: 'host' | 'wsl'
    wslDistro?: string | null
  }) => Promise<ClaudeRateLimitAccountsState>
  cancelPendingLogin: () => Promise<boolean>
  reauthenticate: (args: { accountId: string }) => Promise<ClaudeRateLimitAccountsState>
  remove: (args: { accountId: string }) => Promise<ClaudeRateLimitAccountsState>
  select: (args: {
    accountId: string | null
    runtime?: 'host' | 'wsl'
    wslDistro?: string | null
  }) => Promise<ClaudeRateLimitAccountsState>
}

export type MinimaxCredentialsApi = {
  // Why: cookie + API key each live in their own safeStorage file, so the
  // status separates them. 'configured' stays as the OR so existing callers
  // that only care about "anything saved" keep working unchanged.
  getStatus: () => Promise<{
    configured: boolean
    cookieConfigured: boolean
    apiKeyConfigured: boolean
  }>
  saveCookie: (cookie: string) => Promise<{ cookieConfigured: boolean }>
  clearCookie: () => Promise<{ cookieConfigured: boolean }>
  saveApiKey: (key: string) => Promise<{ apiKeyConfigured: boolean }>
  clearApiKey: () => Promise<{ apiKeyConfigured: boolean }>
}
