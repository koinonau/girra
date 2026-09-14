import { ipcRenderer } from 'electron'
import type { RuntimePairingReach } from '../../shared/runtime-pairing-reach'
import type { PreloadApi } from '../api-types'

export const mobileApi = {
  listNetworkInterfaces: (): Promise<{
    interfaces: { name: string; address: string; hasDefaultRoute?: boolean }[]
  }> => ipcRenderer.invoke('mobile:listNetworkInterfaces'),

  getRuntimePairingUrl: (args?: {
    address?: string
    rotate?: boolean
    // Why: the widen is one-way and host-wide, so main must gate it on the reach the user picked, not
    // on how the typed address happens to look (a Custom loopback may front an SSH tunnel).
    reach?: RuntimePairingReach
  }): Promise<
    | { available: false; reason?: 'network_exposure_failed'; guidance?: string }
    | {
        available: true
        pairingUrl: string
        webClientUrl: string | null
        endpoint: string
        deviceId: string
      }
  > => ipcRenderer.invoke('mobile:getRuntimePairingUrl', args),

  listRuntimeAccessGrants: () => ipcRenderer.invoke('mobile:listRuntimeAccessGrants'),

  revokeRuntimeAccess: (args: { deviceId: string }): Promise<{ revoked: boolean }> =>
    ipcRenderer.invoke('mobile:revokeRuntimeAccess', args)
} satisfies PreloadApi['mobile']
