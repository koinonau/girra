// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendNativeChatMessageVerified = vi.fn()

vi.mock('./native-chat-runtime-send', () => ({
  sendNativeChatMessageVerified: (...args: unknown[]) => sendNativeChatMessageVerified(...args)
}))
vi.mock('./native-chat-pty-send-queue', () => ({
  cancelNativeChatPtySends: vi.fn(),
  waitForNativeChatPtyIdle: vi.fn()
}))

import { useNativeChatSessionOptionCommand } from './use-native-chat-session-option-command'

describe('useNativeChatSessionOptionCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendNativeChatMessageVerified.mockResolvedValue(true)
  })

  it('pastes option commands through the verified send', async () => {
    const hook = renderHook(() =>
      useNativeChatSessionOptionCommand({
        disabled: false,
        resolveTarget: () => ({ settings: {}, ptyId: 'pty-1' }),
        setHistory: vi.fn()
      })
    )
    await act(() => hook.result.current.dispatch('/model sonnet'))

    expect(sendNativeChatMessageVerified).toHaveBeenCalledWith(
      {},
      'pty-1',
      '/model sonnet',
      expect.any(AbortSignal)
    )
  })
})
