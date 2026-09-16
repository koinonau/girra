import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService, RuntimeTerminalDataMeta } from '../orca-runtime'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalStreamText,
  encodeTerminalStreamFrame,
  encodeTerminalStreamJson
} from '../../../shared/terminal-stream-protocol'
import {
  SET_OUTPUT_PAUSED_OPCODE,
  sendDesktopMultiplexSubscribe,
  startDesktopMultiplexSubscribe
} from './terminal-multiplex-test-harness'

describe('terminal multiplex RPC', () => {
  it('withholds sustained output from multiple paused desktop streams', async () => {
    const listeners: ((data: string, meta?: RuntimeTerminalDataMeta) => void)[] = []
    const harness = startDesktopMultiplexSubscribe({
      subscribeToTerminalData: vi.fn((_ptyId, listener) => {
        listeners.push(listener)
        return vi.fn()
      }),
      serializeAuthoritativeTerminalBuffer: vi.fn().mockResolvedValue({
        data: 'authoritative hidden snapshot',
        cols: 120,
        rows: 40,
        seq: 7,
        source: 'headless'
      })
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))

    for (const streamId of [1, 2, 3]) {
      harness.handlers.get(0)?.(
        decodeTerminalStreamFrame(
          encodeTerminalStreamFrame({
            opcode: TerminalStreamOpcode.Subscribe,
            streamId: 0,
            seq: streamId,
            payload: encodeTerminalStreamJson({
              streamId,
              terminal: `terminal-${streamId}`,
              client: { id: `desktop-${streamId}`, type: 'desktop' },
              capabilities: { ackOutput: 1, outputPause: 1 }
            })
          })
        )!
      )
    }
    await vi.waitFor(() =>
      expect(
        harness.messages.filter((message) => JSON.parse(message).result?.type === 'subscribed')
      ).toHaveLength(3)
    )
    const pauseCapable = harness.messages
      .map((message) => JSON.parse(message).result)
      .filter((event) => event?.type === 'subscribed')
      .every((event) => event.capabilities?.outputPause === 1)
    if (pauseCapable) {
      for (const streamId of [1, 2, 3]) {
        harness.handlers.get(streamId)?.(
          decodeTerminalStreamFrame(
            encodeTerminalStreamFrame({
              opcode: SET_OUTPUT_PAUSED_OPCODE,
              streamId,
              seq: 10,
              payload: encodeTerminalStreamJson({ paused: true })
            })
          )!
        )
      }
    }
    harness.binaryFrames.splice(0)
    const chunk = 'x'.repeat(64 * 1024)
    for (let turn = 0; turn < 8; turn += 1) {
      for (const listener of listeners) {
        listener(chunk, { seq: (turn + 1) * chunk.length, rawLength: chunk.length })
      }
    }
    expect(
      harness.binaryFrames.some(
        (bytes) => decodeTerminalStreamFrame(bytes)?.opcode === TerminalStreamOpcode.Output
      )
    ).toBe(false)
    expect(pauseCapable).toBe(true)

    harness.handlers.get(1)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: SET_OUTPUT_PAUSED_OPCODE,
          streamId: 1,
          seq: 11,
          payload: encodeTerminalStreamJson({ paused: false })
        })
      )!
    )
    listeners[0]?.('VISIBLE_MARKER', { seq: 8 * chunk.length + 14, rawLength: 14 })
    listeners[0]?.('y'.repeat(64 * 1024), {
      seq: 9 * chunk.length + 14,
      rawLength: 64 * 1024
    })
    expect(
      harness.binaryFrames
        .map(decodeTerminalStreamFrame)
        .filter((frame) => frame?.opcode === TerminalStreamOpcode.Output)
        .map((frame) => decodeTerminalStreamText(frame!.payload))
        .join('')
    ).toContain('VISIBLE_MARKER')

    harness.registry.cleanupSubscription('terminal-multiplex:conn-desktop-first-paint')
    await harness.dispatchPromise
    expect(harness.handlers.size).toBe(0)
  })

  it('keeps output flowing when an older client does not negotiate pause', async () => {
    const listeners: ((data: string, meta?: RuntimeTerminalDataMeta) => void)[] = []
    const harness = startDesktopMultiplexSubscribe({
      subscribeToTerminalData: vi.fn((_ptyId, nextListener) => {
        listeners.push(nextListener)
        return vi.fn()
      })
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))

    harness.handlers.get(0)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: TerminalStreamOpcode.Subscribe,
          streamId: 0,
          seq: 1,
          payload: encodeTerminalStreamJson({
            streamId: 1,
            terminal: 'terminal-legacy-client',
            client: { id: 'desktop-legacy', type: 'desktop' },
            capabilities: { ackOutput: 1 }
          })
        })
      )!
    )
    await vi.waitFor(() =>
      expect(
        harness.messages
          .map((message) => JSON.parse(message).result)
          .find((event) => event?.type === 'subscribed' && event.streamId === 1)
      ).toMatchObject({ type: 'subscribed', streamId: 1 })
    )
    const subscribed = harness.messages
      .map((message) => JSON.parse(message).result)
      .find((event) => event?.type === 'subscribed' && event.streamId === 1)
    expect(subscribed.capabilities?.outputPause).toBeUndefined()

    harness.handlers.get(1)?.(
      decodeTerminalStreamFrame(
        encodeTerminalStreamFrame({
          opcode: SET_OUTPUT_PAUSED_OPCODE,
          streamId: 1,
          seq: 2,
          payload: encodeTerminalStreamJson({ paused: true })
        })
      )!
    )
    harness.binaryFrames.splice(0)
    listeners[0]?.('LEGACY_VISIBLE'.padEnd(64 * 1024, 'x'), {
      seq: 64 * 1024,
      rawLength: 64 * 1024
    })

    expect(
      harness.binaryFrames
        .map(decodeTerminalStreamFrame)
        .filter((frame) => frame?.opcode === TerminalStreamOpcode.Output)
        .map((frame) => decodeTerminalStreamText(frame!.payload))
        .join('')
    ).toContain('LEGACY_VISIBLE')

    harness.registry.cleanupSubscription('terminal-multiplex:conn-desktop-first-paint')
    await harness.dispatchPromise
  })

  it('emits initial desktop fit events after the first multiplex snapshot', async () => {
    const trace: string[] = []
    let fitListener: ((event: { mode: string; cols: number; rows: number }) => void) | undefined
    const harness = startDesktopMultiplexSubscribe(
      {
        readTerminal: vi.fn(async () => {
          fitListener?.({ mode: 'desktop-fit', cols: 100, rows: 30 })
          return { tail: [], truncated: false } as unknown as Awaited<
            ReturnType<OrcaRuntimeService['readTerminal']>
          >
        }),
        subscribeToFitOverrideChanges: vi.fn((_ptyId, listener) => {
          fitListener = listener
          return vi.fn()
        })
      },
      trace
    )
    await vi.waitFor(() =>
      expect(harness.messages.some((msg) => JSON.parse(msg).result?.type === 'ready')).toBe(true)
    )
    sendDesktopMultiplexSubscribe(harness.handlers)
    await vi.waitFor(() => expect(trace).toContain('fit-override-changed'))
    expect(trace.lastIndexOf('snapshot')).toBeLessThan(trace.indexOf('fit-override-changed'))
    harness.registry.cleanupSubscription('terminal-multiplex:conn-desktop-first-paint')
    await harness.dispatchPromise
  })
})
