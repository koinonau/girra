import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from './dispatcher'
import type { OrcaRuntimeService } from '../orca-runtime'
import { TERMINAL_METHODS } from './methods/terminal'
import { createSubscriptionRegistryDouble } from './subscription-registry-test-double'
import type { RuntimeTerminalWait } from '../../../shared/runtime-types'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  encodeTerminalStreamFrame,
  encodeTerminalStreamJson,
  encodeTerminalStreamText
} from '../../../shared/terminal-stream-protocol'
import {
  WRITE_UNAVAILABLE_OPCODE,
  makeRequest,
  sendDesktopMultiplexSubscribe,
  startDesktopMultiplexSubscribe,
  stubRuntime
} from './terminal-multiplex-test-harness'

describe('terminal multiplex rejected input signalling', () => {
  it('reports when locally accepted input never reaches the process', async () => {
    const processWrites: string[] = []
    const sendTerminal = vi.fn().mockRejectedValue(new Error('terminal_not_writable'))
    const harness = startDesktopMultiplexSubscribe({
      sendTerminal: sendTerminal as unknown as OrcaRuntimeService['sendTerminal']
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(harness.handlers, {
      ackOutput: 1,
      desktopViewportClaims: 1,
      writeUnavailable: 1
    })
    await vi.waitFor(() =>
      expect(
        harness.messages.some((message) => JSON.parse(message).result?.type === 'subscribed')
      ).toBe(true)
    )
    harness.binaryFrames.splice(0)

    const clientInputHandler = harness.handlers.get(7)
    expect(clientInputHandler).toBeDefined()
    clientInputHandler?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Input,
          streamId: 7,
          seq: 2,
          payload: encodeTerminalStreamText('x')
        })
      )!
    )
    const clientReportedAccepted = true

    expect(clientReportedAccepted).toBe(true)
    await vi.waitFor(() => expect(sendTerminal).toHaveBeenCalledOnce())
    expect(processWrites).toEqual([])
    await vi.waitFor(() =>
      expect(harness.binaryFrames.some((frame) => frame[2] === WRITE_UNAVAILABLE_OPCODE)).toBe(true)
    )
  })

  it('does not send an unknown opcode to a legacy client', async () => {
    const sendTerminal = vi.fn().mockRejectedValue(new Error('terminal_not_writable'))
    const harness = startDesktopMultiplexSubscribe({
      sendTerminal: sendTerminal as unknown as OrcaRuntimeService['sendTerminal']
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(harness.handlers)
    await vi.waitFor(() =>
      expect(
        harness.messages.some((message) => JSON.parse(message).result?.type === 'subscribed')
      ).toBe(true)
    )
    harness.binaryFrames.splice(0)

    harness.handlers.get(7)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Input,
          streamId: 7,
          seq: 2,
          payload: encodeTerminalStreamText('x')
        })
      )!
    )

    await vi.waitFor(() => expect(sendTerminal).toHaveBeenCalledOnce())
    expect(harness.binaryFrames.some((frame) => frame[2] === WRITE_UNAVAILABLE_OPCODE)).toBe(false)
  })

  it('does not report a late rejection to a replacement stream with the same id', async () => {
    let settleWrite: (result: {
      handle: string
      accepted: boolean
      bytesWritten: number
    }) => void = () => {}
    const hostWrite = new Promise<{ handle: string; accepted: boolean; bytesWritten: number }>(
      (resolve) => {
        settleWrite = resolve
      }
    )
    const sendTerminal = vi.fn(() => hostWrite)
    const harness = startDesktopMultiplexSubscribe({
      sendTerminal: sendTerminal as unknown as OrcaRuntimeService['sendTerminal']
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))
    const capabilities = { ackOutput: 1 as const, writeUnavailable: 1 as const }
    sendDesktopMultiplexSubscribe(harness.handlers, capabilities)
    await vi.waitFor(() => expect(harness.handlers.has(7)).toBe(true))
    harness.binaryFrames.splice(0)

    harness.handlers.get(7)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Input,
          streamId: 7,
          seq: 2,
          payload: encodeTerminalStreamText('old')
        })
      )!
    )
    await vi.waitFor(() => expect(sendTerminal).toHaveBeenCalledOnce())
    harness.handlers.get(7)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Unsubscribe,
          streamId: 7,
          seq: 3,
          payload: new Uint8Array()
        })
      )!
    )
    sendDesktopMultiplexSubscribe(harness.handlers, capabilities)
    await vi.waitFor(() =>
      expect(
        harness.messages.filter((message) => JSON.parse(message).result?.type === 'subscribed')
      ).toHaveLength(2)
    )
    harness.binaryFrames.splice(0)

    settleWrite({ handle: 'terminal-1', accepted: false, bytesWritten: 0 })
    await hostWrite
    await Promise.resolve()

    expect(harness.binaryFrames.some((frame) => frame[2] === WRITE_UNAVAILABLE_OPCODE)).toBe(false)
  })
})

describe('terminal multiplex RPC', () => {
  it('preserves LF input frames before writing to the multiplexed PTY', async () => {
    const messages: string[] = []
    const handlers = new Map<
      number,
      (frame: NonNullable<ReturnType<typeof decodeTerminalStreamFrame>>) => void
    >()
    const registry = createSubscriptionRegistryDouble()
    const runtime = stubRuntime({
      resolveLiveLeafForHandle: vi.fn().mockReturnValue({ ptyId: 'pty-1' }),
      readTerminal: vi.fn().mockResolvedValue({ tail: [], truncated: false }),
      serializeTerminalBuffer: vi.fn().mockResolvedValue(null),
      getTerminalSize: vi.fn().mockReturnValue({ cols: 120, rows: 40 }),
      getLayout: vi.fn().mockReturnValue({ seq: 1 }),
      subscribeToTerminalData: vi.fn().mockReturnValue(vi.fn()),
      subscribeToTerminalResize: vi.fn().mockReturnValue(vi.fn()),
      subscribeToFitOverrideChanges: vi.fn().mockReturnValue(vi.fn()),
      getTerminalFitOverride: vi.fn().mockReturnValue(null),
      registerSubscriptionCleanup: vi.fn(registry.registerSubscriptionCleanup),
      registerOwnedSubscriptionCleanup: vi.fn(registry.registerOwnedSubscriptionCleanup),
      cleanupSubscription: vi.fn(registry.cleanupSubscription),
      waitForTerminal: vi.fn(() => new Promise<RuntimeTerminalWait>(() => {})),
      sendTerminal: vi.fn().mockResolvedValue({ accepted: true }),
      updateDesktopViewport: vi.fn().mockResolvedValue(true)
    })
    const dispatcher = new RpcDispatcher({
      runtime,
      methods: TERMINAL_METHODS
    })

    const dispatchPromise = dispatcher.dispatchStreaming(
      makeRequest('terminal.multiplex', {}),
      (msg) => messages.push(msg),
      {
        connectionId: 'conn-byte-preserving',
        sendBinary: vi.fn(),
        registerBinaryStreamHandler: (streamId, handler) => {
          handlers.set(streamId, handler)
          return () => handlers.delete(streamId)
        }
      }
    )

    await vi.waitFor(() =>
      expect(messages.some((msg) => JSON.parse(msg).result?.type === 'ready')).toBe(true)
    )
    handlers.get(0)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Subscribe,
          streamId: 0,
          seq: 1,
          payload: encodeTerminalStreamJson({
            streamId: 9,
            terminal: 'terminal-1',
            client: { id: 'desktop-1', type: 'desktop' }
          })
        })
      )!
    )
    await vi.waitFor(() => expect(handlers.has(9)).toBe(true))

    handlers.get(9)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Input,
          streamId: 9,
          seq: 2,
          payload: encodeTerminalStreamText('echo one\necho two\r\n')
        })
      )!
    )

    await vi.waitFor(() =>
      expect(runtime.sendTerminal).toHaveBeenCalledWith('terminal-1', {
        text: 'echo one\necho two\r\n',
        enter: false,
        interrupt: false
      })
    )

    runtime.cleanupSubscription('terminal-multiplex:conn-byte-preserving')
    await dispatchPromise
  })
})
