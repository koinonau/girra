import { app, type BrowserWindow } from 'electron'
import { createMainWindow, loadMainWindow } from '../window/createMainWindow'
import { shouldRecoverRendererAfterProcessGone } from '../crash-reporting/process-gone-classification'
import { resolveConsent } from '../telemetry/consent'
import { trackAppOpenedOnce } from '../telemetry/client'
import { ensureWindowsUserDataAclGrant } from './windows-user-data-acl'
import { probeWindowsInstallDirAcl } from './windows-install-dir-acl-probe'
import {
  noteWindowsInstallDirAclProbePending,
  startWindowsInstallDirAclRepairIfPoisoned
} from './windows-install-dir-acl-recovery'
import { logStartupMilestone } from './startup-diagnostics'
import { notifyMainWindowBecameVisible } from '../window/main-window-visibility'
import { setTrayAttention } from '../tray/system-tray'
import {
  createSystemTrayDeferred,
  getSystemTrayOptions,
  showMainWindowFromTray,
  showRendererRecoveryPrompt,
  syncMacMenuBarIcon
} from './main-window-actions'
import { attachMainWindowCoreServices } from './main-window-core-services'
import {
  clearMainWindowAgentStatusListeners,
  installMainWindowAgentStatusListeners
} from './main-window-agent-status'
import { mainProcessState as state } from './main-process-state'
import {
  clearExpectedRendererReload,
  markExpectedRendererReload,
  markRecoveryReloadInFlight,
  getExpectedTeardownScope
} from './main-window-lifecycle-flags'
import { presentGpuFallbackRecoveredLaunchPrompt } from './gpu-lifecycle'
import { maybeAutoRenameBranchOnFirstWorkFromHook } from './branch-rename-hook'
import {
  resumeSyntheticTitleSpinnerTimer,
  stopSyntheticTitleSpinnerTimer
} from './synthetic-title-runtime'
import { requireMainWindowServices } from './main-window-service-readiness'

const TRAY_CREATE_FALLBACK_MS = 12_000

export function openMainWindow(options: { revealOnDidFinishLoad?: boolean } = {}): BrowserWindow {
  logStartupMilestone('open-main-window-start')
  const { store, keybindings } = requireMainWindowServices({
    store: state.store,
    runtime: state.runtime,
    stats: state.stats,
    claudeUsage: state.claudeUsage,
    codexUsage: state.codexUsage,
    openCodeUsage: state.openCodeUsage,
    rateLimits: state.rateLimits,
    automations: state.automations,
    codexAccounts: state.codexAccounts,
    codexRuntimeHome: state.codexRuntimeHome,
    claudeAccounts: state.claudeAccounts,
    claudeRuntimeAuth: state.claudeRuntimeAuth,
    keybindings: state.keybindings
  })
  if (process.platform === 'win32') {
    logStartupMilestone('acl-grant-start')
    ensureWindowsUserDataAclGrant(app.getPath('userData'), {
      onDone: (result) => {
        logStartupMilestone('acl-grant-done', { mode: result.mode })
        if (result.mode === 'failed') {
          console.warn('[win32-acl] userData ACL grant failed:', result.reason)
        }
      }
    })
    // Why here: read-only, and the install DACL is the one thing a 0x80000003
    // child death cannot tell us about itself. See electron/electron#51761.
    const probeDispatched = probeWindowsInstallDirAcl({
      isServeMode: state.isServeMode,
      onDone: (data) =>
        startWindowsInstallDirAclRepairIfPoisoned(data, {
          isServeMode: state.isServeMode,
          userDataPath: app.getPath('userData'),
          appVersion: app.getVersion()
        })
    })
    // Why gated on the dispatch: the probe is once-per-process while openMainWindow
    // re-runs on every reopen, so arming this again would wait on a verdict that
    // already landed — and drop every GPU crash for the grace window.
    if (probeDispatched) {
      noteWindowsInstallDirAclProbePending()
    }
  }
  const window = createMainWindow(store, {
    getIsQuitting: () => state.isQuitting,
    onQuitAborted: () => {
      state.isQuitting = false
      clearExpectedRendererReload()
    },
    shouldRecoverRenderer: (details, webContentsId) =>
      shouldRecoverRendererAfterProcessGone({
        reason: details.reason,
        expectedTeardown: getExpectedTeardownScope(webContentsId)
      }),
    onRendererRecoveryExhausted: ({ recentRecoveryCount, cause, retry }) => {
      void showRendererRecoveryPrompt(recentRecoveryCount, cause, retry)
    },
    deferLoad: true,
    ...(options.revealOnDidFinishLoad === true ? { revealOnDidFinishLoad: true } : {}),
    title: state.devInstanceIdentity?.name ?? app.name,
    getKeybindings: () => keybindings.getOverrides(),
    onBeforeReload: ({ webContentsId }) => {
      if (state.mainWindow?.webContents.id === webContentsId) {
        markExpectedRendererReload(webContentsId)
      }
    },
    onBeforeRecoveryReload: (webContentsId) => {
      markRecoveryReloadInFlight(webContentsId)
    }
  })
  logStartupMilestone('window-created')
  const createTray = createSystemTrayDeferred(window, () => logStartupMilestone('tray-created'))
  window.once('ready-to-show', () => {
    logStartupMilestone('ready-to-show')
    setImmediate(createTray)
  })
  window.once('show', () => {
    logStartupMilestone('window-shown')
    void presentGpuFallbackRecoveredLaunchPrompt(window)
  })
  const trayCreateFallback = setTimeout(createTray, TRAY_CREATE_FALLBACK_MS)
  trayCreateFallback.unref?.()
  const rendererWebContentsId = window.webContents.id
  const onFirstWindowLoad = (): void => {
    clearExpectedRendererReload(rendererWebContentsId)
    logStartupMilestone('did-finish-load')
    // Why cleared here: a reload drops the old ui:openMarkdownFiles listener, and the fresh
    // renderer re-attaches by pulling. Pushing into the gap between would be silently lost.
    state.markdownFileOpenListenerReady = false
    const currentStore = state.store
    if (currentStore && resolveConsent(currentStore.getSettings()).effective === 'enabled') {
      trackAppOpenedOnce()
    }
  }
  window.webContents.on('did-finish-load', onFirstWindowLoad)
  attachMainWindowCoreServices(window, { markExpectedRendererReload })
  state.mainWindow = window
  window.on('show', resumeSyntheticTitleSpinnerTimer)
  window.on('restore', resumeSyntheticTitleSpinnerTimer)
  window.on('hide', stopSyntheticTitleSpinnerTimer)
  window.on('minimize', stopSyntheticTitleSpinnerTimer)
  window.on('show', notifyMainWindowBecameVisible)
  window.on('restore', notifyMainWindowBecameVisible)
  window.on('show', () => setTrayAttention(false))
  window.on('restore', () => setTrayAttention(false))
  installMainWindowAgentStatusListeners({
    window,
    maybeAutoRenameBranchOnFirstWork: maybeAutoRenameBranchOnFirstWorkFromHook
  })
  window.on('closed', () => {
    if (state.mainWindow === window) {
      state.mainWindow = null
    }
    clearExpectedRendererReload(rendererWebContentsId)
    state.automations?.setWebContents(null)
    clearMainWindowAgentStatusListeners()
  })
  logStartupMilestone('load-start')
  loadMainWindow(window)
  return window
}

export function configureWindowActions(): void {
  // Kept as a named seam for startup composition; action callbacks are state-backed.
  void getSystemTrayOptions
  void showMainWindowFromTray
  void syncMacMenuBarIcon
}
