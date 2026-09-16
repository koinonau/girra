import { defineMethod } from '../../core'
import { TerminalHandle } from './unary-schemas'
import { TerminalUpdateViewport } from './viewport-schemas'
import { updateViewportForClient } from './terminal-viewport-update'

export const TERMINAL_VIEWPORT_METHODS = [
  defineMethod({
    name: 'terminal.restoreFit',
    params: TerminalHandle,
    handler: async (params, { runtime }) => {
      // Why: a stale handle must fail with terminal_handle_stale, not reclaim the wrong PTY to desktop dims (#7718).
      const leaf = runtime.resolveLiveLeafForHandle(params.terminal)
      if (!leaf?.ptyId) {
        throw new Error('no_connected_pty')
      }
      return { restored: await runtime.reclaimTerminalForDesktop(leaf.ptyId) }
    }
  }),
  defineMethod({
    name: 'terminal.updateViewport',
    params: TerminalUpdateViewport,
    handler: async (params, { runtime }) => {
      // Why: a stale handle must fail with terminal_handle_stale, not write viewport state to the wrong PTY (#7718).
      const leaf = runtime.resolveLiveLeafForHandle(params.terminal)
      if (!leaf?.ptyId) {
        throw new Error('no_connected_pty')
      }
      const viewportUpdate = await updateViewportForClient(
        runtime,
        leaf.ptyId,
        `viewport:${params.client.id}`,
        params.client,
        params.viewport,
        // Why: one-shot RPC with no disconnect hook — refresh the existing stream-owned floor, never create a leak-prone one.
        'refresh',
        params.claim === true
      )
      return { ...viewportUpdate, seq: runtime.getLayout(leaf.ptyId)?.seq }
    }
  })
]
