import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from './dispatcher'
import type { RpcRequest } from './core'
import type { OrcaRuntimeService } from '../orca-runtime'
import { TERMINAL_METHODS } from './methods/terminal'
import { CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS } from '../../../shared/clipboard-text'
import {
  TERMINAL_INPUT_MAX_BYTES,
  TERMINAL_INPUT_TOO_LARGE_ERROR
} from '../../../shared/terminal-input'

function stubRuntime(overrides: Partial<OrcaRuntimeService> = {}): OrcaRuntimeService {
  return { getRuntimeId: () => 'test-runtime', ...overrides } as OrcaRuntimeService
}

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

describe('terminal send RPC', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports whether a terminal handle is running a recognized agent', async () => {
    const runtime = stubRuntime({
      isTerminalRunningAgent: vi.fn().mockResolvedValue(true)
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.isRunningAgent', {
        terminal: 'terminal-1'
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({ isRunningAgent: true })
    expect(runtime.isTerminalRunningAgent).toHaveBeenCalledWith('terminal-1')
  })

  it('reports runtime-owned terminal agent status', async () => {
    const runtime = stubRuntime({
      getTerminalAgentStatus: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        isRunningAgent: true,
        status: 'permission'
      })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.agentStatus', {
        terminal: 'terminal-1'
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({
      agentStatus: {
        handle: 'terminal-1',
        isRunningAgent: true,
        status: 'permission'
      }
    })
    expect(runtime.getTerminalAgentStatus).toHaveBeenCalledWith('terminal-1')
  })

  it('fails terminal.send with terminal_handle_stale for a stale handle instead of probing the wrong PTY', async () => {
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn(() => {
        throw new Error('terminal_handle_stale')
      }),
      sendTerminal: vi.fn()
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'stale-terminal',
        text: 'x',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response.ok).toBe(false)
    if (response.ok) {
      throw new Error('expected stale handle error')
    }
    expect(response.error.message).toContain('terminal_handle_stale')
    expect(runtime.sendTerminal).not.toHaveBeenCalled()
  })

  it('awaits a desktop viewport claim before acknowledged input', async () => {
    let releaseClaim = (): void => {}
    const refreshRemoteDesktopViewer = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          releaseClaim = () => resolve(true)
        })
    )
    const sendTerminal = vi.fn().mockImplementation(async (_handle, _action, options) => {
      await options.beforeWrite?.('pty-1')
      return { handle: 'terminal-1', accepted: true, bytesWritten: 1 }
    })
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      refreshRemoteDesktopViewer,
      sendTerminal
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        text: '\x03',
        client: { id: 'desktop-1', type: 'desktop' },
        viewport: { cols: 96, rows: 32 },
        claimViewport: true
      })
    )

    await vi.waitFor(() =>
      expect(refreshRemoteDesktopViewer).toHaveBeenCalledWith('pty-1', 'desktop-1', 96, 32, true)
    )
    expect(sendTerminal).not.toHaveBeenCalled()
    releaseClaim()
    await expect(response).resolves.toMatchObject({ ok: true })
    expect(sendTerminal).toHaveBeenCalled()
  })

  it('rejects oversized terminal send text before runtime dispatch', async () => {
    const secret = 'terminal-send-secret'
    const runtime = stubRuntime({
      sendTerminal: vi.fn()
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        text: [secret, 'x'.repeat(TERMINAL_INPUT_MAX_BYTES + 1)].join('')
      })
    )

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_argument',
        message: TERMINAL_INPUT_TOO_LARGE_ERROR
      }
    })
    expect(JSON.stringify(response)).not.toContain(secret)
    expect(runtime.sendTerminal).not.toHaveBeenCalled()
  })

  it('rejects multibyte oversized terminal send text before runtime dispatch', async () => {
    const runtime = stubRuntime({
      sendTerminal: vi.fn()
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })
    const text = '😀'.repeat(Math.floor(TERMINAL_INPUT_MAX_BYTES / 4) + 1)

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        text
      })
    )

    expect(text.length).toBeLessThan(TERMINAL_INPUT_MAX_BYTES)
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_argument',
        message: TERMINAL_INPUT_TOO_LARGE_ERROR
      }
    })
    expect(runtime.sendTerminal).not.toHaveBeenCalled()
  })

  it('yields while validating large accepted terminal send text before runtime dispatch', async () => {
    vi.useFakeTimers()
    const text = 'é'.repeat(CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS + 1)
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      sendTerminal: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        accepted: true,
        bytesWritten: text.length
      })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const responsePromise = dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        text
      })
    )
    await Promise.resolve()

    expect(runtime.sendTerminal).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(0)
    await expect(responsePromise).resolves.toMatchObject({
      ok: true,
      result: { send: { accepted: true } }
    })
    expect(runtime.sendTerminal).toHaveBeenCalledWith(
      'terminal-1',
      {
        text,
        enter: false,
        interrupt: false
      },
      { beforeWrite: undefined }
    )
  })

  it('refuses guarded terminal sends when the agent needs permission', async () => {
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      getTerminalAgentStatus: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        isRunningAgent: true,
        status: 'permission'
      }),
      sendTerminal: vi.fn()
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        enter: true,
        requireAgentStatus: 'sendable',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({
      send: {
        handle: 'terminal-1',
        accepted: false,
        bytesWritten: 0,
        refusedReason: 'permission'
      }
    })
    expect(runtime.getTerminalAgentStatus).toHaveBeenCalledWith('terminal-1')
    expect(runtime.sendTerminal).not.toHaveBeenCalled()
  })

  it('allows guarded terminal sends when the agent is sendable', async () => {
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      getTerminalAgentStatus: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        isRunningAgent: true,
        status: 'working'
      }),
      sendTerminal: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        accepted: true,
        bytesWritten: 1
      })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        enter: true,
        requireAgentStatus: 'sendable',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toMatchObject({ send: { accepted: true, bytesWritten: 1 } })
    expect(runtime.sendTerminal).toHaveBeenCalledWith(
      'terminal-1',
      {
        text: undefined,
        enter: true,
        interrupt: false
      },
      { beforeWrite: expect.any(Function) }
    )
  })

  it('writes zero bytes when a guarded callback observes a handle rebind during status', async () => {
    let boundPtyId = 'pty-1'
    let statusCalls = 0
    const write = vi.fn()
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn(() => ({ ptyId: boundPtyId })),
      getTerminalAgentStatus: vi.fn().mockImplementation(async () => {
        statusCalls += 1
        if (statusCalls === 2) {
          boundPtyId = 'pty-2'
        }
        return {
          handle: 'terminal-1',
          isRunningAgent: true,
          status: 'working'
        }
      }),
      sendTerminal: vi.fn().mockImplementation(async (_handle, _action, options) => {
        await options.beforeWrite('pty-1')
        write('pty-1', '\r')
        return { handle: 'terminal-1', accepted: true, bytesWritten: 1 }
      })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        enter: true,
        requireAgentStatus: 'sendable',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response).toMatchObject({
      ok: true,
      result: { send: { accepted: false, bytesWritten: 0 } }
    })
    expect(runtime.getTerminalAgentStatus).toHaveBeenCalledTimes(2)
    expect(write).not.toHaveBeenCalled()
  })

  it('rejects a guarded callback whose actual write PTY differs from the handle binding', async () => {
    const write = vi.fn()
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn(() => ({ ptyId: 'pty-1' })),
      getTerminalAgentStatus: vi.fn().mockResolvedValue({
        handle: 'terminal-1',
        isRunningAgent: true,
        status: 'working'
      }),
      sendTerminal: vi.fn().mockImplementation(async (_handle, _action, options) => {
        await options.beforeWrite('pty-2')
        write('pty-2', '\r')
        return { handle: 'terminal-1', accepted: true, bytesWritten: 1 }
      })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        enter: true,
        requireAgentStatus: 'sendable',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response).toMatchObject({
      ok: true,
      result: { send: { accepted: false, bytesWritten: 0 } }
    })
    expect(runtime.getTerminalAgentStatus).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
  })

  it('refuses guarded combined text and submit sends before any PTY write', async () => {
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      getTerminalAgentStatus: vi.fn(),
      sendTerminal: vi.fn()
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.send', {
        terminal: 'terminal-1',
        text: 'notes',
        enter: true,
        requireAgentStatus: 'sendable',
        client: { id: 'desktop-1', type: 'desktop' }
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({
      send: {
        handle: 'terminal-1',
        accepted: false,
        bytesWritten: 0
      }
    })
    expect(runtime.getTerminalAgentStatus).not.toHaveBeenCalled()
    expect(runtime.sendTerminal).not.toHaveBeenCalled()
  })

  it('routes terminal restore fit through the runtime driver state machine', async () => {
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      reclaimTerminalForDesktop: vi.fn().mockResolvedValue(true)
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: TERMINAL_METHODS })

    const response = await dispatcher.dispatch(
      makeRequest('terminal.restoreFit', {
        terminal: 'terminal-1'
      })
    )

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    expect(response.result).toEqual({ restored: true })
    expect(runtime.reclaimTerminalForDesktop).toHaveBeenCalledWith('pty-1')
  })
  // Why: mobile gates reply forwarding on this static capability; removing it
  // would silently re-break mobile query answering against current hosts.
})
