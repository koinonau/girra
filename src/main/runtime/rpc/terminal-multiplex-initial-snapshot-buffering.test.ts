import { describe, expect, it, vi } from 'vitest'
import type { RuntimeTerminalDataMeta } from '../orca-runtime'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalStreamJson,
  decodeTerminalStreamText
} from '../../../shared/terminal-stream-protocol'
import {
  sendDesktopMultiplexSubscribe,
  startDesktopMultiplexSubscribe
} from './terminal-multiplex-test-harness'

type DeferredSnapshot = { data: string; cols: number; rows: number; seq?: number }

/** Subscribe with the buffer serializer parked, so output can arrive mid-snapshot. */
function startWithDeferredSnapshot() {
  const dataListenerRef: { current?: (data: string, meta?: RuntimeTerminalDataMeta) => void } = {}
  let resolveSnapshot: (value: DeferredSnapshot) => void = () => {}
  const harness = startDesktopMultiplexSubscribe({
    readTerminal: vi.fn().mockResolvedValue({ tail: [], truncated: false }),
    serializeTerminalBuffer: vi.fn(
      () =>
        new Promise<DeferredSnapshot>((resolve) => {
          resolveSnapshot = resolve
        })
    ),
    subscribeToTerminalData: vi.fn((_ptyId, listener) => {
      dataListenerRef.current = listener
      return vi.fn()
    })
  })
  return {
    ...harness,
    dataListenerRef,
    // Why await the call: the data listener is installed before the serializer runs, so a
    // resolve keyed off the listener alone would fire before the deferred promise exists.
    resolveSnapshot: async (value: DeferredSnapshot) => {
      await vi.waitFor(() =>
        expect(vi.mocked(harness.runtime.serializeTerminalBuffer)).toHaveBeenCalled()
      )
      resolveSnapshot(value)
    }
  }
}

function outputText(frames: readonly Uint8Array<ArrayBufferLike>[]): string {
  return frames
    .map((frame) => decodeTerminalStreamFrame(frame))
    .filter((frame) => frame?.opcode === TerminalStreamOpcode.Output)
    .map((frame) => (frame ? decodeTerminalStreamText(frame.payload) : ''))
    .join('')
}

describe('terminal multiplex RPC', () => {
  it('keeps layout versions out of the output sequence domain', async () => {
    let dataListener: ((data: string, meta?: RuntimeTerminalDataMeta) => void) | undefined
    const harness = startDesktopMultiplexSubscribe({
      getLayout: vi.fn().mockReturnValue({ seq: 675 }),
      serializeTerminalBuffer: vi.fn().mockResolvedValue({
        data: 'restored terminal',
        cols: 120,
        rows: 40,
        source: 'renderer'
      }),
      subscribeToTerminalData: vi.fn((_ptyId, listener) => {
        dataListener = listener
        return vi.fn()
      })
    })
    await vi.waitFor(() => expect(harness.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(harness.handlers)
    await vi.waitFor(() =>
      expect(
        harness.messages.some((message) => JSON.parse(message).result?.type === 'subscribed')
      ).toBe(true)
    )

    const subscribed = harness.messages
      .map((message) => JSON.parse(message).result)
      .find((event) => event?.type === 'subscribed')
    const snapshotStart = harness.binaryFrames
      .map(decodeTerminalStreamFrame)
      .find((frame) => frame?.opcode === TerminalStreamOpcode.SnapshotStart)
    expect(subscribed.seq).toBe(675)
    if (!snapshotStart) {
      throw new Error('Missing multiplex snapshot start frame')
    }
    const snapshotPayload = decodeTerminalStreamJson(snapshotStart.payload)
    expect(snapshotPayload).toMatchObject({ kind: 'scrollback' })
    expect(snapshotPayload).not.toHaveProperty('seq')

    harness.binaryFrames.splice(0)
    dataListener?.('live', { seq: 4, rawLength: 4 })
    await vi.waitFor(() =>
      expect(
        harness.binaryFrames.some((bytes) => {
          const frame = decodeTerminalStreamFrame(bytes)
          return frame?.opcode === TerminalStreamOpcode.Output && frame.seq === 4
        })
      ).toBe(true)
    )

    harness.registry.cleanupSubscription('terminal-multiplex:conn-desktop-first-paint')
    await harness.dispatchPromise
  })

  it('flushes output buffered during the initial multiplex snapshot once', async () => {
    const h = startWithDeferredSnapshot()
    await vi.waitFor(() => expect(h.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(h.handlers)

    await vi.waitFor(() => expect(h.dataListenerRef.current).toBeDefined())
    h.dataListenerRef.current?.('starting shell\r\n', { seq: 16, rawLength: 16 })
    await h.resolveSnapshot({ data: '', cols: 120, rows: 40 })
    await vi.waitFor(() =>
      expect(h.messages.some((msg) => JSON.parse(msg).result?.type === 'subscribed')).toBe(true)
    )

    await vi.waitFor(() => expect(outputText(h.binaryFrames)).toBe('starting shell\r\n'))

    h.registry.cleanupSubscriptionsForConnection('conn-desktop-first-paint')
    await h.dispatchPromise
  })

  it('drops buffered multiplex output already covered by the initial snapshot seq', async () => {
    const h = startWithDeferredSnapshot()
    await vi.waitFor(() => expect(h.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(h.handlers)

    await vi.waitFor(() => expect(h.dataListenerRef.current).toBeDefined())
    const startupLine = 'starting shell\r\n'
    h.dataListenerRef.current?.(startupLine, {
      seq: startupLine.length,
      rawLength: startupLine.length
    })
    await h.resolveSnapshot({ data: startupLine, cols: 120, rows: 40, seq: startupLine.length })
    await vi.waitFor(() =>
      expect(h.messages.some((msg) => JSON.parse(msg).result?.type === 'subscribed')).toBe(true)
    )

    const snapshotStart = h.binaryFrames
      .map((frame) => decodeTerminalStreamFrame(frame))
      .find((frame) => frame?.opcode === TerminalStreamOpcode.SnapshotStart)
    expect(snapshotStart && decodeTerminalStreamJson(snapshotStart.payload)).toMatchObject({
      seq: startupLine.length
    })
    expect(outputText(h.binaryFrames)).toBe('')

    h.registry.cleanupSubscriptionsForConnection('conn-desktop-first-paint')
    await h.dispatchPromise
  })

  it('replays only buffered multiplex output not covered by the initial snapshot seq', async () => {
    const h = startWithDeferredSnapshot()
    await vi.waitFor(() => expect(h.handlers.has(0)).toBe(true))
    sendDesktopMultiplexSubscribe(h.handlers)

    await vi.waitFor(() => expect(h.dataListenerRef.current).toBeDefined())
    const buffered = 'hello world'
    h.dataListenerRef.current?.(buffered, { seq: buffered.length, rawLength: buffered.length })
    await h.resolveSnapshot({ data: 'hello', cols: 120, rows: 40, seq: 'hello'.length })
    await vi.waitFor(() =>
      expect(h.messages.some((msg) => JSON.parse(msg).result?.type === 'subscribed')).toBe(true)
    )

    await vi.waitFor(() => expect(outputText(h.binaryFrames)).toBe(' world'))

    h.registry.cleanupSubscriptionsForConnection('conn-desktop-first-paint')
    await h.dispatchPromise
  })
})
