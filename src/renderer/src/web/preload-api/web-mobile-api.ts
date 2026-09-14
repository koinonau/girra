import type { PreloadApi } from '../../../../preload/api-types'

export function createWebMobileApi(): Partial<PreloadApi> {
  return {
    mobile: {
      listNetworkInterfaces: () => Promise.resolve({ interfaces: [] }),
      getRuntimePairingUrl: () => Promise.resolve({ available: false }),
      listRuntimeAccessGrants: () => Promise.resolve({ grants: [] }),
      revokeRuntimeAccess: () => Promise.resolve({ revoked: false })
    }
  }
}
