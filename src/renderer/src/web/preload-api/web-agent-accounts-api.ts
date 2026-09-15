import type { PreloadApi } from '../../../../preload/api-types'

export function createMiniMaxCredentialsApi(): NonNullable<
  Partial<PreloadApi>['minimaxCredentials']
> {
  const notConfigured = { configured: false, cookieConfigured: false, apiKeyConfigured: false }
  const unsupportedError = new Error('MiniMax cookie storage is only available in the desktop app.')
  return {
    getStatus: () => Promise.resolve(notConfigured),
    saveCookie: () => Promise.reject(unsupportedError),
    clearCookie: () => Promise.resolve(notConfigured),
    saveApiKey: () => Promise.reject(unsupportedError),
    clearApiKey: () => Promise.resolve(notConfigured)
  }
}

export function createAccountsApi(): never {
  const empty = {
    accounts: [],
    activeAccountId: null,
    activeAccountIdsByRuntime: { host: null, wsl: {} }
  }
  return {
    list: () => Promise.resolve(empty),
    add: () => Promise.resolve(empty),
    cancelPendingLogin: () => Promise.resolve(false),
    reauthenticate: () => Promise.resolve(empty),
    remove: () => Promise.resolve(empty),
    select: () => Promise.resolve(empty)
  } as never
}
