import { ipcRenderer } from 'electron'
import type { ClientHostedBrowserRowsEvent } from '../../shared/client-hosted-browser-rows'
import type {
  RuntimeRendererSyncWindowGraph,
  RuntimeStatus,
  RuntimeSyncWindowGraphResult
} from '../../shared/runtime-types'
import type { RuntimeRpcResponse } from '../../shared/runtime-rpc-envelope'
import type { RuntimeEnvironmentSubscriptionHandle } from '../runtime-environment-subscriptions'
import type { PreloadApi } from '../api-types'

export const runtimeApi = {
  syncWindowGraph: (graph: RuntimeRendererSyncWindowGraph): Promise<RuntimeSyncWindowGraphResult> =>
    ipcRenderer.invoke('runtime:syncWindowGraph', graph),
  getStatus: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:getStatus'),
  call: (args: { method: string; params?: unknown }): Promise<RuntimeRpcResponse<unknown>> =>
    ipcRenderer.invoke('runtime:call', args),
  subscribe: async (
    args: { method: string; params?: unknown },
    callback: (response: RuntimeRpcResponse<unknown>) => void
  ): Promise<RuntimeEnvironmentSubscriptionHandle> => {
    const subscriptionId = `desktop-${crypto.randomUUID()}`
    const channel = `runtime:subscription:${subscriptionId}`
    const listener = (_event: Electron.IpcRendererEvent, response: RuntimeRpcResponse<unknown>) =>
      callback(response)
    ipcRenderer.on(channel, listener)
    try {
      await ipcRenderer.invoke('runtime:subscribe', { subscriptionId, ...args })
    } catch (error) {
      ipcRenderer.removeListener(channel, listener)
      throw error
    }
    return {
      unsubscribe: () => {
        ipcRenderer.removeListener(channel, listener)
        ipcRenderer.send('runtime:unsubscribe', { subscriptionId })
      },
      sendBinary: () => {
        throw new Error('Local runtime subscriptions do not accept binary input')
      }
    }
  },
  getTerminalFitOverrides: (): Promise<
    { ptyId: string; mode: 'remote-desktop-fit'; cols: number; rows: number }[]
  > => ipcRenderer.invoke('runtime:getTerminalFitOverrides'),
  getBrowserRemoteViewerPages: (): Promise<string[]> =>
    ipcRenderer.invoke('runtime:getBrowserRemoteViewerPages'),
  getClientHostedBrowserRows: (): Promise<ClientHostedBrowserRowsEvent[]> =>
    ipcRenderer.invoke('runtime:getClientHostedBrowserRows'),
  restoreTerminalFit: (ptyId: string): Promise<{ restored: boolean }> =>
    ipcRenderer.invoke('runtime:restoreTerminalFit', { ptyId }),
  onTerminalFitOverrideChanged: (
    callback: (event: {
      ptyId: string
      mode: 'remote-desktop-fit' | 'desktop-fit'
      cols: number
      rows: number
    }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        ptyId: string
        mode: 'remote-desktop-fit' | 'desktop-fit'
        cols: number
        rows: number
      }
    ) => callback(data)
    ipcRenderer.on('runtime:terminalFitOverrideChanged', listener)
    return () => ipcRenderer.removeListener('runtime:terminalFitOverrideChanged', listener)
  },
  onBrowserRemoteViewersChanged: (
    callback: (event: { browserPageId: string; hasRemoteViewers: boolean }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        browserPageId: string
        hasRemoteViewers: boolean
      }
    ) => callback(data)
    ipcRenderer.on('runtime:browserRemoteViewersChanged', listener)
    return () => ipcRenderer.removeListener('runtime:browserRemoteViewersChanged', listener)
  },
  onClientHostedBrowserRowsChanged: (
    callback: (event: ClientHostedBrowserRowsEvent) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ClientHostedBrowserRowsEvent) =>
      callback(data)
    ipcRenderer.on('runtime:clientHostedBrowserRowsChanged', listener)
    return () => ipcRenderer.removeListener('runtime:clientHostedBrowserRowsChanged', listener)
  }
} satisfies PreloadApi['runtime']
