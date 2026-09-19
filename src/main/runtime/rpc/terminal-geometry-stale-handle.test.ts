import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from './dispatcher'
import type { RpcRequest } from './core'
import type { OrcaRuntimeService } from '../orca-runtime'
import { TERMINAL_METHODS } from './methods/terminal'

// Why: the terminal geometry family (resize/setDisplayMode/restoreFit/
// updateViewport) mutates PTY state. A remote client can hold a handle minted
// for a PTY that was later replaced under the pane (restart/re-spawn bumps
// ptyId/generation). The UNGUARDED resolveLeafForHandle returns the pane's
// CURRENT pty, so a stale client would mutate the wrong (new) PTY — visible as
// geometry corruption on the fresh session (#7718). These methods must use the
// guarded resolveLiveLeafForHandle, which throws terminal_handle_stale instead.

// Models a stale handle exactly as the runtime does: the unguarded resolver
// silently adopts the replacement PTY ('pty-b'); the guarded resolver throws.
const NEW_PTY_UNDER_PANE = 'pty-b'

function stubStaleHandleRuntime(overrides: Partial<OrcaRuntimeService> = {}): OrcaRuntimeService {
  return {
    getRuntimeId: () => 'test-runtime',
    // Unguarded path: returns the pane's current (replaced) PTY — the misroute.
    resolveLeafForHandle: vi.fn().mockReturnValue({ ptyId: NEW_PTY_UNDER_PANE }),
    // Guarded path: surfaces the staleness.
    resolveLiveLeafForHandle: vi.fn(() => {
      throw new Error('terminal_handle_stale')
    }),
    ...overrides
  } as unknown as OrcaRuntimeService
}

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

async function expectStale(method: string, params: unknown, mutators: string[]): Promise<void> {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const name of mutators) {
    spies[name] = vi.fn()
  }
  const runtime = stubStaleHandleRuntime(spies as Partial<OrcaRuntimeService>)
  const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

  const response = await dispatcher.dispatch(makeRequest(method, params))

  expect(response.ok).toBe(false)
  if (response.ok) {
    throw new Error(`expected ${method} to reject a stale handle`)
  }
  expect(response.error.message).toContain('terminal_handle_stale')
  // The wrong (replacement) PTY must never be mutated.
  for (const name of mutators) {
    expect(spies[name]).not.toHaveBeenCalled()
  }
}

describe('terminal geometry family rejects stale handles instead of mutating the wrong PTY', () => {
  it('terminal.restoreFit fails with terminal_handle_stale', async () => {
    await expectStale('terminal.restoreFit', { terminal: 'stale-terminal' }, [
      'reclaimTerminalForDesktop'
    ])
  })

  it('terminal.updateViewport fails with terminal_handle_stale', async () => {
    await expectStale(
      'terminal.updateViewport',
      {
        terminal: 'stale-terminal',
        client: { id: 'client-1', type: 'desktop' },
        viewport: { cols: 80, rows: 24 }
      },
      ['updateMobileViewport', 'updateDesktopViewport']
    )
  })
})

describe('terminal geometry family still mutates the live PTY for a fresh handle', () => {
  // Why it reclaims nothing: the desktop take-back path is gone and this method survives only so
  // an older paired client gets `false` rather than `method_not_found`. It still resolves the
  // handle, so the stale case above keeps failing before the answer.
  it('terminal.restoreFit answers a live handle without reclaiming', async () => {
    const resolveLiveLeafForHandle = vi.fn().mockReturnValue({ ptyId: 'pty-a' })
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      resolveLiveLeafForHandle
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.restoreFit', { terminal: 'live-terminal' })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({ restored: false })
    expect(resolveLiveLeafForHandle).toHaveBeenCalledWith('live-terminal')
  })

  it('terminal.updateViewport updates the resolved PTY when the handle is live', async () => {
    const refreshRemoteDesktopViewer = vi.fn().mockResolvedValue(true)
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-a' }),
      refreshRemoteDesktopViewer,
      getLayout: vi.fn().mockReturnValue({ seq: 7 })
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.updateViewport', {
        terminal: 'live-terminal',
        client: { id: 'client-1', type: 'desktop' },
        viewport: { cols: 80, rows: 24 },
        claim: true
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(refreshRemoteDesktopViewer).toHaveBeenCalledWith('pty-a', 'client-1', 80, 24, true)
    expect(response.result).toEqual({ updated: true, applied: true, seq: 7 })
  })
})
