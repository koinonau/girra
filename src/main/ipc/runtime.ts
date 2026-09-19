import { BrowserWindow, ipcMain } from 'electron'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type {
  RuntimeRendererSyncWindowGraph,
  RuntimeStatus,
  RuntimeSyncWindowGraphResult
} from '../../shared/runtime-types'
import type { RuntimeRpcResponse } from '../../shared/runtime-rpc-envelope'
import type { ClientHostedBrowserRowsEvent } from '../../shared/client-hosted-browser-rows'
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

export function registerRuntimeHandlers(runtime: OrcaRuntimeService): void {
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
}
