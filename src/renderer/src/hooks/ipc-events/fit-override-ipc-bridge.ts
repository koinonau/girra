import {
  hydrateBrowserRemoteViewerPages,
  setRemoteViewersForBrowserPage
} from '@/lib/pane-manager/browser-remote-viewer-state'
import {
  applyClientHostedBrowserRows,
  hydrateClientHostedBrowserRows
} from '@/lib/pane-manager/client-hosted-browser-row-state'
import type { ClientHostedBrowserRowsEvent } from '../../../../shared/client-hosted-browser-rows'
import { setFitOverride, hydrateOverrides } from '@/lib/pane-manager/fit-overrides'

const MAX_PENDING_FIT_STATE_EVENTS = 300

type PendingFitStateEvent =
  | {
      kind: 'fit'
      event: {
        ptyId: string
        mode: 'remote-desktop-fit' | 'desktop-fit'
        cols: number
        rows: number
      }
    }
  | {
      kind: 'browser-remote-viewers'
      event: { browserPageId: string; hasRemoteViewers: boolean }
    }

export function registerFitOverrideIpcBridge(
  unsubs: (() => void)[],
  isRuntimeEnvironmentActive: () => boolean
): () => void {
  let fitStateHydrated = isRuntimeEnvironmentActive()
  const pendingFitStateEvents: PendingFitStateEvent[] = []
  let disposed = false

  const applyPendingFitStateEvents = (): void => {
    for (const pending of pendingFitStateEvents) {
      if (pending.kind === 'fit') {
        const { ptyId, mode, cols, rows } = pending.event
        setFitOverride(ptyId, mode, cols, rows)
      } else {
        setRemoteViewersForBrowserPage(pending.event.browserPageId, pending.event.hasRemoteViewers)
      }
    }
    pendingFitStateEvents.length = 0
  }
  const enqueue = (event: PendingFitStateEvent): void => {
    pendingFitStateEvents.push(event)
    while (pendingFitStateEvents.length > MAX_PENDING_FIT_STATE_EVENTS) {
      pendingFitStateEvents.shift()
    }
  }

  unsubs.push(
    window.api.runtime.onTerminalFitOverrideChanged((event) => {
      if (isRuntimeEnvironmentActive()) {
        return
      }
      if (!fitStateHydrated) {
        enqueue({ kind: 'fit', event })
        return
      }
      setFitOverride(event.ptyId, event.mode, event.cols, event.rows)
    })
  )

  const unsubscribeBrowserRemoteViewers = window.api.runtime.onBrowserRemoteViewersChanged?.(
    (event) => {
      if (isRuntimeEnvironmentActive()) {
        return
      }
      if (!fitStateHydrated) {
        enqueue({ kind: 'browser-remote-viewers', event })
        return
      }
      setRemoteViewersForBrowserPage(event.browserPageId, event.hasRemoteViewers)
    }
  )
  if (unsubscribeBrowserRemoteViewers) {
    unsubs.push(unsubscribeBrowserRemoteViewers)
  }

  // Why: no isRuntimeEnvironmentActive guard, unlike the fit channel above. These rows
  // describe pages a paired client renders for THIS runtime's own worktrees; pointing the window
  // at a remote environment does not make them someone else's, and dropping them would leave the
  // host with an uncloseable page it cannot see. Hydration below is unguarded for the same reason.
  let clientHostedRowsHydrated = false
  const pendingClientHostedRowEvents: ClientHostedBrowserRowsEvent[] = []
  const settleClientHostedRowHydration = (): void => {
    clientHostedRowsHydrated = true
    for (const event of pendingClientHostedRowEvents) {
      applyClientHostedBrowserRows(event)
    }
    pendingClientHostedRowEvents.length = 0
  }
  unsubs.push(
    window.api.runtime.onClientHostedBrowserRowsChanged((event) => {
      // Why: subscribe before the snapshot round trip and buffer, or the older snapshot
      // overwrites a page created while it was in flight.
      if (!clientHostedRowsHydrated) {
        pendingClientHostedRowEvents.push(event)
        while (pendingClientHostedRowEvents.length > MAX_PENDING_FIT_STATE_EVENTS) {
          pendingClientHostedRowEvents.shift()
        }
        return
      }
      applyClientHostedBrowserRows(event)
    })
  )
  void window.api.runtime
    .getClientHostedBrowserRows()
    .then((events) => {
      if (disposed) {
        return
      }
      hydrateClientHostedBrowserRows(events)
      settleClientHostedRowHydration()
    })
    .catch((error: unknown) => {
      if (disposed) {
        return
      }
      console.error('Failed to hydrate client-hosted browser rows:', error)
      settleClientHostedRowHydration()
    })

  // Subscribe before snapshots; queued pushes replay in arrival order after both hydrate.
  if (!isRuntimeEnvironmentActive()) {
    void Promise.all([
      window.api.runtime.getTerminalFitOverrides(),
      window.api.runtime.getBrowserRemoteViewerPages?.() ?? []
    ])
      .then(([overrides, remoteViewerPages]) => {
        if (disposed) {
          return
        }
        hydrateOverrides(overrides)
        hydrateBrowserRemoteViewerPages(remoteViewerPages)
        fitStateHydrated = true
        applyPendingFitStateEvents()
      })
      .catch((error: unknown) => {
        if (disposed) {
          return
        }
        console.error('Failed to hydrate terminal fit state:', error)
        fitStateHydrated = true
        applyPendingFitStateEvents()
      })
  }

  return () => {
    disposed = true
    pendingFitStateEvents.length = 0
    pendingClientHostedRowEvents.length = 0
  }
}
