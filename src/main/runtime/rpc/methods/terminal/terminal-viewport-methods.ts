import { defineMethod } from '../../core'
import { TerminalHandle } from './unary-schemas'
import { TerminalUpdateViewport } from './viewport-schemas'
import { updateViewportForClient } from './terminal-viewport-update'

export const TERMINAL_VIEWPORT_METHODS = [
  defineMethod({
    // Why kept with nothing behind it: the desktop take-back path is gone, but an older paired
    // client still carries its preload bridge, and `method_not_found` is a louder failure than the
    // `false` that path already returned for every caller. A host reclaims through
    // `pty:claimViewport` on host input instead. Retire this with the next wire cleanup.
    // Why still resolve the handle: a stale one must fail with terminal_handle_stale (#7718)
    // rather than answer for a PTY it does not name.
    name: 'terminal.restoreFit',
    params: TerminalHandle,
    handler: async (params, { runtime }) => {
      const leaf = runtime.resolveLiveLeafForHandle(params.terminal)
      if (!leaf?.ptyId) {
        throw new Error('no_connected_pty')
      }
      return { restored: false }
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
