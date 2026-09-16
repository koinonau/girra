import { BrowserWindow, ipcMain } from 'electron'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type {
  RuntimeRendererSyncWindowGraph,
  RuntimeStatus,
  RuntimeSyncWindowGraphResult
} from '../../shared/runtime-types'
import type { RuntimeRpcResponse } from '../../shared/runtime-rpc-envelope'
import type { ClientHostedBrowserRowsEvent } from '../../shared/client-hosted-browser-rows'
import { TERMINAL_FIT_RESTORE_DEADLINE_MS } from '../../shared/terminal-fit-restore-deadline'
import {
  AGENT_SESSION_BACKGROUND_TASK_ROW_STOP_CAPABILITY,
  AGENT_SESSION_BACKGROUND_TASK_STOP_CAPABILITY,
  AGENT_SESSION_PENDING_SEND_RESULT_RUNTIME_CAPABILITY,
  AGENT_SESSION_TURN_ITEM_CAPABILITY,
  CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
} from '../../shared/protocol-version'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { ALL_RPC_METHODS } from '../runtime/rpc/methods'
import { DesktopRuntimeSenderLifecycle } from './desktop-runtime-sender-lifecycle'

function boundTerminalFitRestore(pending: Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), TERMINAL_FIT_RESTORE_DEADLINE_MS)
    timer.unref?.()
  })
  return Promise.race([pending, deadline]).finally(() => clearTimeout(timer))
}

export function registerRuntimeHandlers(runtime: OrcaRuntimeService): void {
  const pendingTerminalFitRestores = new Map<string, Promise<boolean>>()
  const desktopSenders = new DesktopRuntimeSenderLifecycle(runtime)
  ipcMain.removeHandler('runtime:syncWindowGraph')
  ipcMain.removeHandler('runtime:getStatus')
  ipcMain.removeHandler('runtime:call')
  ipcMain.removeHandler('runtime:subscribe')
  ipcMain.removeAllListeners('runtime:unsubscribe')

  ipcMain.handle(
    'runtime:syncWindowGraph',
    (event, graph: RuntimeRendererSyncWindowGraph): RuntimeSyncWindowGraphResult => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('Runtime graph sync must originate from a BrowserWindow')
      }
      if (event.senderFrame !== event.sender.mainFrame) {
        // Why: a disposed main frame can leave an invoke queued after its
        // replacement starts. It must not settle the replacement generation.
        throw new Error('Runtime graph sync must originate from the current main frame')
      }
      if (typeof graph.rendererGeneration !== 'string' || graph.rendererGeneration.length === 0) {
        throw new Error('Runtime graph sync requires a renderer generation')
      }
      return runtime.syncWindowGraph(window.id, graph)
    }
  )

  ipcMain.handle('runtime:getStatus', (): RuntimeStatus => {
    return runtime.getStatus()
  })

  ipcMain.handle(
    'runtime:call',
    async (
      event,
      args: { method: string; params?: unknown }
    ): Promise<RuntimeRpcResponse<unknown>> => {
      if (event.senderFrame !== event.sender.mainFrame) {
        throw new Error('Runtime RPC call must originate from the current main frame')
      }
      return (await new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS }).dispatch(
        {
          id: 'desktop-ipc',
          authToken: 'desktop-ipc',
          method: args.method,
          params: args.params
        },
        {
          clientId: 'desktop-renderer',
          clientKind: 'runtime',
          connectionId: desktopSenders.connectionIdFor(event.sender),
          clientCapabilities: [
            AGENT_SESSION_BACKGROUND_TASK_STOP_CAPABILITY,
            AGENT_SESSION_PENDING_SEND_RESULT_RUNTIME_CAPABILITY,
            AGENT_SESSION_TURN_ITEM_CAPABILITY,
            AGENT_SESSION_BACKGROUND_TASK_ROW_STOP_CAPABILITY,
            STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
            CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
          ]
        }
      )) as RuntimeRpcResponse<unknown>
    }
  )

  ipcMain.handle(
    'runtime:subscribe',
    (
      event,
      args: { subscriptionId: string; method: string; params?: unknown }
    ): { subscribed: boolean } => {
      if (event.senderFrame !== event.sender.mainFrame) {
        throw new Error('Runtime subscription must originate from the current main frame')
      }
      const senderSubscriptions = desktopSenders.subscriptionsFor(event.sender)
      const connectionId = desktopSenders.connectionIdFor(event.sender)
      const previous = senderSubscriptions.get(args.subscriptionId)
      previous?.abort()
      const controller = new AbortController()
      senderSubscriptions.set(args.subscriptionId, controller)
      const channel = `runtime:subscription:${args.subscriptionId}`
      const stop = (): void => {
        if (senderSubscriptions.get(args.subscriptionId) === controller) {
          senderSubscriptions.delete(args.subscriptionId)
        }
      }
      void new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS })
        .dispatchStreaming(
          {
            id: args.subscriptionId,
            authToken: 'desktop-ipc',
            method: args.method,
            params: args.params
          },
          (response) => {
            if (!controller.signal.aborted && !event.sender.isDestroyed()) {
              event.sender.send(channel, JSON.parse(response) as RuntimeRpcResponse<unknown>)
            }
          },
          {
            signal: controller.signal,
            clientId: 'desktop-renderer',
            clientKind: 'runtime',
            connectionId,
            clientCapabilities: [
              AGENT_SESSION_BACKGROUND_TASK_STOP_CAPABILITY,
              AGENT_SESSION_PENDING_SEND_RESULT_RUNTIME_CAPABILITY,
              AGENT_SESSION_TURN_ITEM_CAPABILITY,
              AGENT_SESSION_BACKGROUND_TASK_ROW_STOP_CAPABILITY,
              STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
              CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
            ]
          }
        )
        .finally(stop)
      return { subscribed: true }
    }
  )

  ipcMain.on('runtime:unsubscribe', (event, args: { subscriptionId: string }) => {
    const senderSubscriptions = desktopSenders.existingSubscriptionsFor(event.sender)
    senderSubscriptions?.get(args.subscriptionId)?.abort()
    senderSubscriptions?.delete(args.subscriptionId)
  })

  ipcMain.removeHandler('runtime:getTerminalFitOverrides')
  ipcMain.handle(
    'runtime:getTerminalFitOverrides',
    (): {
      ptyId: string
      mode: 'remote-desktop-fit'
      cols: number
      rows: number
    }[] => {
      const overrides = runtime.getAllTerminalFitOverrides()
      return Array.from(overrides.entries()).map(([ptyId, override]) => ({
        ptyId,
        ...override
      }))
    }
  )

  ipcMain.removeHandler('runtime:getBrowserRemoteViewerPages')
  ipcMain.handle('runtime:getBrowserRemoteViewerPages', (): string[] =>
    runtime.getBrowserRemoteViewerPages()
  )

  // Why: the renderer holds these rows in memory only, so a reload has nothing to restore from.
  ipcMain.removeHandler('runtime:getClientHostedBrowserRows')
  ipcMain.handle('runtime:getClientHostedBrowserRows', (): ClientHostedBrowserRowsEvent[] =>
    runtime.listClientHostedBrowserRows()
  )

  // Why: this IPC powers the desktop "Take back" button — it drops a remote
  // desktop's fit hold and restores the PTY to this window's dimensions.
  ipcMain.removeHandler('runtime:restoreTerminalFit')
  ipcMain.handle('runtime:restoreTerminalFit', async (_event, args: { ptyId: string }) => {
    // Why async: reclaimTerminalForDesktop awaits a PTY-resize chain. Returning
    // the unresolved Promise to ipcMain made Electron try to structured-clone a
    // Promise — "An object could not be cloned" error — and the renderer's
    // restoreTerminalFit() rejected with no useful info.
    // Why: keep one underlying reclaim per PTY even after callers time out;
    // layout serialization means a retry cannot bypass the wedged operation.
    let pending = pendingTerminalFitRestores.get(args.ptyId)
    if (!pending) {
      try {
        let tracked!: Promise<boolean>
        const clearTrackedRestore = (): void => {
          if (pendingTerminalFitRestores.get(args.ptyId) === tracked) {
            pendingTerminalFitRestores.delete(args.ptyId)
          }
        }
        tracked = runtime.reclaimTerminalForDesktop(args.ptyId).then(
          (restored) => {
            clearTrackedRestore()
            return restored
          },
          () => {
            clearTrackedRestore()
            return false
          }
        )
        pending = tracked
        pendingTerminalFitRestores.set(args.ptyId, pending)
      } catch {
        return { restored: false }
      }
    }
    return { restored: await boundTerminalFitRestore(pending) }
  })
}
