// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithFitOverrideListeners } from './orca-runtime-fit-override-listeners'
import { RuntimeEdgeCommandController } from './runtime-edge-command-controller'
import { getBrowserHostLeaseRegistry } from './browser-host-lease-registry-instance'
import { getRuntimeBrowserPageRegistry } from './runtime-browser-page-registry'
import type {
  LayoutQueueEntry,
  PtyLayoutState,
  RuntimeCommandSurfaceHost
} from './orca-runtime-core'
import { RemoteDesktopTerminalFloor } from './remote-desktop-terminal-floor'
import type { StatsCollector } from '../stats/collector'
import { RuntimeRemoteFetchController } from './runtime-remote-fetch-controller'
import { RuntimeWorktreeBaseReconciliation } from './runtime-worktree-base-reconciliation'
import { RuntimeWorktreeRemovalInFlight } from './runtime-worktree-removal-in-flight'

export class OrcaRuntimeWithTerminalDrivers extends OrcaRuntimeWithFitOverrideListeners {
  protected readonly edgeCommands = new RuntimeEdgeCommandController({
    browserHost: {
      getAgentBrowserBridge: () => this.agentBrowserBridge,
      resolveWorktreeSelector: (selector) => this.resolveWorktreeSelector(selector),
      resolveBrowserWorkspace: (selector) => this.resolveBrowserWorkspace(selector),
      getBrowserHostLeaseRegistry: () => getBrowserHostLeaseRegistry(this),
      getRuntimeBrowserPageRegistry: () => getRuntimeBrowserPageRegistry(this),
      resolveBrowserNetworkExecutionHost: (worktree) =>
        this.resolveBrowserNetworkExecutionHostForWorktree(worktree),
      getAuthoritativeWindow: () => this.getAuthoritativeWindow(),
      getAvailableAuthoritativeWindow: () => this.getAvailableAuthoritativeWindow(),
      getOffscreenBrowserBackend: () => this.offscreenBrowserBackend,
      markHeadlessBrowserSessionTabActive: this.markHeadlessBrowserSessionTabActive.bind(this),
      notifyHeadlessBrowserSessionTabsChanged: (worktreeId) =>
        this.notifyMobileSessionTabsChanged(worktreeId),
      retireRuntimeOwnedBrowserSessionTab: (worktreeId, browserPageId) =>
        this.retireRuntimeOwnedBrowserSessionTab(worktreeId, browserPageId)
    },
    screencast: {
      registerSubscriptionCleanup: (subscriptionId, cleanup, connectionId) =>
        (this as RuntimeCommandSurfaceHost<this>).registerSubscriptionCleanup(
          subscriptionId,
          cleanup,
          connectionId
        ),
      cleanupSubscription: (subscriptionId) =>
        (this as RuntimeCommandSurfaceHost<this>).cleanupSubscription(subscriptionId),
      notifyRemoteViewersChanged: (browserPageId, hasRemoteViewers) =>
        this.notifier?.browserRemoteViewersChanged?.(browserPageId, hasRemoteViewers)
    },
    getBrowserCommands: () => this.browserCommands,
    emulatorHost: {
      getEmulatorBridge: () => this.emulatorBridge,
      resolveEmulatorWorkspaceId: (selector) => this.resolveEmulatorWorkspaceId(selector),
      resolveEmulatorCleanupWorkspaceId: (selector) =>
        this.resolveEmulatorCleanupWorkspaceId(selector),
      getAuthoritativeWindow: () => this.getAuthoritativeWindow(),
      getSettings: () => this.requireStore().getSettings()
    }
  })

  // Why: tests and diagnostic seams replace only screencast startup; ordinary edge methods stay pre-bound.
  protected browserCommands = this.edgeCommands.getBrowserCommands()

  protected readonly remoteDesktopFloor = new RemoteDesktopTerminalFloor({
    getTerminalSize: (ptyId) => this.getTerminalSize(ptyId) ?? null,
    resolveHostTarget: (ptyId) => this.resolveDesktopRestoreTarget(ptyId),
    applyLayout: async (ptyId, target) => {
      this.freshSubscribeGuard.add(ptyId)
      try {
        return await this.enqueueLayout(ptyId, target)
      } finally {
        this.freshSubscribeGuard.delete(ptyId)
      }
    }
  })

  // Why: tracks the last PTY size set by the desktop renderer (via pty:resize
  // IPC). Unlike ptySizes (which is overwritten by server-side remote-driven
  // resizes), this map preserves the actual pane geometry. Used as the
  // preferred source for previousCols so desktop restore uses the correct
  // split-pane width instead of a stale full-width value.
  protected lastRendererSizes = new Map<string, { cols: number; rows: number }>()

  // Why: when a desktop-fit override change fires, the desktop renderer's
  // re-render cascade (triggered by setOverrideTick) runs safeFit on ALL
  // panes — not just the affected one. Background tab panes get measured at
  // full-width (214) instead of their correct split width (105). The stale
  // pty:resize IPCs overwrite both the actual PTY size and lastRendererSizes.
  // This global window suppresses ALL pty:resize for 200ms after any
  // desktop-fit notification. The server has already set the correct PTY
  // size via ptyController.resize(), so desktop renderer resizes during
  // this window are redundant (for the restored pane) or wrong (collateral).
  protected resizeSuppressedUntil = 0

  // Why: inline resize events replace the unsubscribe→resubscribe pattern.
  // Listeners are notified when mode changes or desktop restores, allowing
  // the subscribe stream to emit a 'resized' event with fresh scrollback.
  // `seq` is the layout state-machine sequence number bumped on every
  // applyLayout success; clients use it to drop stale events that
  // arrive after a newer transition. See docs/mobile-terminal-layout-state-machine.md.
  protected resizeListeners = new Map<
    string,
    Set<
      (event: {
        cols: number
        rows: number
        displayMode: string
        reason: string
        seq?: number
      }) => void
    >
  >()

  // Why: per-PTY layout state machine. `applyLayout` is the sole writer of
  // `layouts`, `terminalFitOverrides`, and `ptyController.resize`; every
  // trigger method routes through `enqueueLayout`. The monotonic `seq` is
  // emitted on the terminal stream so clients can drop stale events.
  // See docs/mobile-terminal-layout-state-machine.md.
  protected layouts = new Map<string, PtyLayoutState>()

  // Why: per-PTY async serialization queue for applyLayout. Without
  // serialization, two concurrent triggers can interleave around the
  // ptyController.resize await and bump seq in the wrong order, defeating
  // seq-as-truth. Coalesces same-kind same-owner viewport ticks so the
  // viewport animation doesn't queue 10+ resizes; mode flips and
  // different-owner targets always append (preserves viewer fairness).
  // See docs/mobile-terminal-layout-state-machine.md "enqueueLayout coalescing".
  protected layoutQueues = new Map<string, LayoutQueueEntry>()

  // Why: gate so enqueueLayout's "no layouts entry" short-circuit doesn't
  // fire on the very first transition for a PTY (where the entry doesn't
  // exist yet *because* we're about to create it). Callers add the ptyId
  // before calling enqueueLayout and remove it after the call resolves.
  protected freshSubscribeGuard = new Set<string>()

  protected stats: StatsCollector | null = null

  // Why: create and drift probes must share one fetch/freshness owner.
  protected readonly remoteFetches = new RuntimeRemoteFetchController()

  protected readonly worktreeBaseReconciliation = new RuntimeWorktreeBaseReconciliation(
    this.remoteFetches,
    () => this.notifier
  )

  protected readonly removeManagedWorktreeInFlight = new RuntimeWorktreeRemovalInFlight()
}
