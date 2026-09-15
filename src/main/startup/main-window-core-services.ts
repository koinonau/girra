import type { BrowserWindow } from 'electron'
import { registerCoreHandlers } from '../ipc/register-core-handlers/register-core-handlers'
import { attachMainWindowServices } from '../window/attach-main-window-services'
import { initTccPromptNotice } from '../macos-tcc-prompt-notice'
import { mainProcessState as state } from './main-process-state'
import { preserveAgentAuthBeforeRestart } from '../agent-auth-restart-preservation'
import { emitPluginWorktreeLifecycle } from './main-process-pty-startup'
import { isRecoveryReloadInFlight } from './main-window-lifecycle-flags'

export function attachMainWindowCoreServices(
  window: BrowserWindow,
  deps: {
    markExpectedRendererReload: (webContentsId: number) => void
  }
): void {
  const store = state.store
  const runtime = state.runtime
  const stats = state.stats
  const claudeUsage = state.claudeUsage
  const openCodeUsage = state.openCodeUsage
  const claudeAccounts = state.claudeAccounts
  const rateLimits = state.rateLimits
  const automations = state.automations
  const keybindings = state.keybindings
  const claudeRuntimeAuth = state.claudeRuntimeAuth
  if (
    !store ||
    !runtime ||
    !stats ||
    !claudeUsage ||
    !openCodeUsage ||
    !claudeAccounts ||
    !rateLimits ||
    !automations ||
    !keybindings ||
    !claudeRuntimeAuth
  ) {
    throw new Error('Main window services must be initialized before attaching')
  }
  registerCoreHandlers(
    store,
    runtime,
    stats,
    claudeUsage,
    openCodeUsage,
    claudeAccounts,
    rateLimits,
    window.webContents.id,
    automations,
    {
      prepareForClaudeLaunch: (target) => claudeRuntimeAuth.prepareForClaudeLaunch(target)
    },
    state.agentAwakeService ?? undefined,
    keybindings,
    {
      onBeforeRelaunch: async () => {
        state.isQuitting = true
        await preserveAgentAuthBeforeRestart({ claudeRuntimeAuth, store })
      }
    },
    state.pluginService ?? undefined,
    state.pluginMarketplaceService && state.pluginMarketplaceInstaller
      ? { marketplace: state.pluginMarketplaceService, installer: state.pluginMarketplaceInstaller }
      : undefined
  )
  automations.setWebContents(window.webContents)
  automations.start()
  attachMainWindowServices(
    window,
    store,
    runtime,
    (target) => claudeRuntimeAuth.prepareForClaudeLaunch(target),
    {
      awaitLocalPtyStartup: () => state.localPtyStartupReady,
      awaitLocalPtyProviderStartup: () => state.localPtyProviderStartupReady,
      onBeforeRendererReload: ({ webContentsId }) => {
        if (window.webContents.id === webContentsId) {
          deps.markExpectedRendererReload(webContentsId)
        }
      },
      // Why: let the PTY layer skip its orphan sweep on the recovery reload that re-fires did-finish-load, so live local sessions survive (#5787).
      isRecoveryReloadInFlight,
      onWorktreeLifecycle: emitPluginWorktreeLifecycle
    }
  )
  // Why: attach the durable renderer pull now, but launch the diagnostic process after first paint.
  initTccPromptNotice(window, { deferWatchUntilReadyToShow: true })
  rateLimits.attach(window)
  // Why: quota probes spawn CLIs and hit network, so don't fetch immediately and compete with first paint; show/focus listeners refresh later.
  rateLimits.start({ fetchImmediately: false })
}
