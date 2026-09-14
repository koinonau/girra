import type { RuntimePairingReach } from '../../shared/runtime-pairing-reach'
import type { RuntimeAccessGrant } from '../../shared/runtime-access-grants'

export type MobileApi = {
  listNetworkInterfaces: () => Promise<{
    interfaces: { name: string; address: string; hasDefaultRoute?: boolean }[]
  }>
  getRuntimePairingUrl: (args?: {
    address?: string
    rotate?: boolean
    reach?: RuntimePairingReach
  }) => Promise<
    | {
        available: false
        reason?: 'network_exposure_failed'
        guidance?: string
      }
    | {
        available: true
        pairingUrl: string
        webClientUrl: string | null
        endpoint: string
        deviceId: string
      }
  >
  listRuntimeAccessGrants: () => Promise<{ grants: RuntimeAccessGrant[] }>
  revokeRuntimeAccess: (args: { deviceId: string }) => Promise<{ revoked: boolean }>
}
