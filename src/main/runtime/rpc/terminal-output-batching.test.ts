import { describe, expect, it, vi } from 'vitest'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalStreamText
} from '../../../shared/terminal-stream-protocol'
import { iterateTerminalOutputFrameChunks } from './terminal-output-frame-chunks'
import {
  sendDesktopMultiplexSubscribe,
  startDesktopMultiplexSubscribe
} from './terminal-multiplex-test-harness'

function outputText(frames: readonly Uint8Array<ArrayBufferLike>[]): string[] {
  return frames
    .map((frame) => decodeTerminalStreamFrame(frame))
    .filter((frame) => frame?.opcode === TerminalStreamOpcode.Output)
    .map((frame) => (frame ? decodeTerminalStreamText(frame.payload) : ''))
}

describe('terminal output batching', () => {
  it('coalesces terminal output bursts into one binary output frame', async () => {
    vi.useFakeTimers()
    try {
      const dataListenerRef: { current?: (data: string) => void } = {}
      const { binaryFrames, handlers, registry, dispatchPromise } = startDesktopMultiplexSubscribe({
        subscribeToTerminalData: vi.fn((_: string, listener: (data: string) => void) => {
          dataListenerRef.current = listener
          return vi.fn()
        })
      })

      await vi.waitFor(() => expect(handlers.size).toBeGreaterThan(0))
      sendDesktopMultiplexSubscribe(handlers)
      await vi.waitFor(() => expect(dataListenerRef.current).toBeDefined())
      binaryFrames.length = 0

      dataListenerRef.current?.('a')
      dataListenerRef.current?.('b')
      expect(outputText(binaryFrames)).toEqual([])

      await vi.runOnlyPendingTimersAsync()

      expect(outputText(binaryFrames)).toEqual(['ab'])

      registry.cleanupSubscriptionsForConnection('conn-desktop-first-paint')
      await dispatchPromise
    } finally {
      vi.useRealTimers()
    }
  })

  it('encodes a large output burst chunk by chunk rather than up front', () => {
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode')
    const output = 'x'.repeat(48 * 1024 * 20 + 17)

    const chunks = iterateTerminalOutputFrameChunks(output)
    encodeSpy.mockClear()
    const first = chunks.next()
    const encodesAtFirstChunk = encodeSpy.mock.calls.length
    const rest = [...chunks]

    // Why: a paste-sized burst must not be encoded in full to produce its first frame.
    expect(rest.length).toBeGreaterThan(10)
    expect(encodesAtFirstChunk).toBeLessThan(rest.length)
    expect(
      [first.value!, ...rest].map((chunk) => decodeTerminalStreamText(chunk.bytes)).join('')
    ).toBe(output)
  })
})
