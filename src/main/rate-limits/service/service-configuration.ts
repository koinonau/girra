import type { BrowserWindow } from 'electron'
import { hasMiniMaxSessionCookie } from '../../minimax/minimax-cookie-store'
import { hasMiniMaxApiKey } from '../../minimax/minimax-api-key-store'
import { RateLimitServiceAccountRefresh } from './service-account-refresh'
import {
  type ClaudeAccountSelectionTarget,
  type ClaudeAuthPreparationResolver,
  type OpenCodeGoRateLimitConfig,
  type MiniMaxRateLimitConfig,
  type InactiveClaudeAccountInfo,
  type RateLimitState,
  normalizeClaudeAccountSelectionTarget,
  type NetworkProxySettings
} from './service-types'

export abstract class RateLimitServiceConfiguration extends RateLimitServiceAccountRefresh {
  setClaudeAuthPreparationResolver(resolver: ClaudeAuthPreparationResolver): void {
    this.claudeAuthPreparationResolver = resolver
  }

  setClaudeFetchTarget(target?: ClaudeAccountSelectionTarget): void {
    this.claudeFetchTarget = normalizeClaudeAccountSelectionTarget(target)
  }

  setOpenCodeGoConfigResolver(resolver: () => OpenCodeGoRateLimitConfig): void {
    this.openCodeGoConfigResolver = resolver
  }

  setMiniMaxConfigResolver(resolver: () => MiniMaxRateLimitConfig): void {
    this.miniMaxConfigResolver = resolver
  }

  setNetworkProxySettingsResolver(resolver: () => NetworkProxySettings): void {
    this.networkProxySettingsResolver = resolver
  }

  setInactiveClaudeAccountsResolver(resolver: () => InactiveClaudeAccountInfo[]): void {
    this.inactiveClaudeAccountsResolver = resolver
    this.inactiveClaudeAccountsGeneration += 1
  }

  attach(mainWindow: BrowserWindow): void {
    this.detachWindowListeners?.()
    this.mainWindow = mainWindow
    const refreshOnResume = (): void => {
      void this.refreshIfWindowActive()
    }
    // Why: attach() can replace windows; remove the previous closed listener too, not only the focus listeners.
    const detachWindowListeners = (): void => {
      mainWindow.removeListener('focus', refreshOnResume)
      mainWindow.removeListener('show', refreshOnResume)
      mainWindow.removeListener('restore', refreshOnResume)
      mainWindow.removeListener('closed', onClosed)
    }
    const onClosed = (): void => {
      detachWindowListeners()
      if (this.detachWindowListeners === detachWindowListeners) {
        this.detachWindowListeners = null
      }
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null
      }
    }
    mainWindow.on('focus', refreshOnResume)
    mainWindow.on('show', refreshOnResume)
    mainWindow.on('restore', refreshOnResume)
    mainWindow.on('closed', onClosed)
    this.detachWindowListeners = detachWindowListeners
  }

  start(options: { fetchImmediately?: boolean } = {}): void {
    if (options.fetchImmediately !== false) {
      void this.fetchAll()
    } else {
      this.scheduleDeferredStartupRefresh()
    }
    this.startTimer()
  }

  stop(): void {
    this.abortActiveFetchCycle()
    this.clearQueuedFetches()
    this.inactiveClaudeFetching.clear()
    this.resolveAndClearFetchIdleWaiters()
    this.stopTimer()
    this.clearDeferredStartupRefresh()
    this.detachWindowListeners?.()
    this.detachWindowListeners = null
    this.mainWindow = null
  }

  getState(): RateLimitState {
    this.pruneInactiveClaudeState()
    return {
      ...this.state,
      // Why: the cookie lives on the filesystem, not GlobalSettings; surface its presence so the renderer keeps the MiniMax bar across reloads.
      minimaxCookieConfigured: hasMiniMaxSessionCookie(),
      minimaxApiKeyConfigured: hasMiniMaxApiKey(),
      claudeTarget: this.claudeFetchTarget,
      inactiveClaudeAccounts: this.buildInactiveArray(
        this.inactiveClaudeCache,
        this.inactiveClaudeFetching
      )
    }
  }
}
