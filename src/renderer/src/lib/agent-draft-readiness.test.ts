import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bufferPreHandlerPtyData,
  clearPreHandlerPtyState,
  drainPreHandlerPtyData
} from '@/components/terminal-pane/pty-pre-handler-buffer'
import { waitForAgentDraftInputReady } from './agent-draft-readiness'

const testState = vi.hoisted(() => ({
  observer: null as ((data: string) => void) | null,
  unsubscribe: vi.fn()
}))

vi.mock('@/components/terminal-pane/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: (_ptyId: string, observer: (data: string) => void) => {
    testState.observer = observer
    return testState.unsubscribe
  }
}))

vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  isRemoteRuntimePtyId: () => false
}))

const PTY_ID = 'pty-buffered-opencode'
const DECSET_BRACKETED_PASTE = '\x1b[?2004h'
const OPENCODE_COMPOSER_CURSOR = '\x1b[?25h'

describe('waitForAgentDraftInputReady', () => {
  afterEach(() => {
    clearPreHandlerPtyState(PTY_ID)
    testState.observer = null
    testState.unsubscribe.mockReset()
    vi.useRealTimers()
  })

  it('observes buffered startup bytes without consuming the primary drain', async () => {
    vi.useFakeTimers()
    bufferPreHandlerPtyData(PTY_ID, DECSET_BRACKETED_PASTE)
    bufferPreHandlerPtyData(PTY_ID, OPENCODE_COMPOSER_CURSOR)
    const primary = vi.fn()

    await expect(
      waitForAgentDraftInputReady(PTY_ID, 20_000, 'render-cursor-after-bracketed-paste', {})
    ).resolves.toBe(true)
    drainPreHandlerPtyData(PTY_ID, primary)

    expect(testState.unsubscribe).toHaveBeenCalledOnce()
    expect(primary.mock.calls).toEqual([
      [DECSET_BRACKETED_PASTE, undefined],
      [OPENCODE_COMPOSER_CURSOR, undefined]
    ])
    expect(vi.getTimerCount()).toBe(0)
  })
})
