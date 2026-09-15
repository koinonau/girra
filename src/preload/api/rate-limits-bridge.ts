import { ipcRenderer } from 'electron'
import type { RateLimitRuntimeTarget, RateLimitState } from '../../shared/rate-limit-types'
import type { PreloadApi } from '../api-types'

export const rateLimitsApi = {
  get: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:get'),
  refresh: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:refresh'),
  refreshClaudeForTarget: (target: RateLimitRuntimeTarget): Promise<RateLimitState> =>
    ipcRenderer.invoke('rateLimits:refreshClaudeForTarget', target),
  setPollingInterval: (ms: number): Promise<void> =>
    ipcRenderer.invoke('rateLimits:setPollingInterval', ms),
  fetchInactiveClaudeAccounts: (): Promise<void> =>
    ipcRenderer.invoke('rateLimits:fetchInactiveClaudeAccounts'),
  refreshMiniMax: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:refreshMiniMax'),
  onUpdate: (callback: (state: RateLimitState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: RateLimitState) => callback(state)
    ipcRenderer.on('rateLimits:update', listener)
    return () => ipcRenderer.removeListener('rateLimits:update', listener)
  }
} satisfies PreloadApi['rateLimits']
