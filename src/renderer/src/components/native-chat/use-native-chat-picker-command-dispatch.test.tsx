// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_HISTORY } from './native-chat-composer-state'

const sendNativeChatMessage = vi.fn()

vi.mock('./native-chat-runtime-send', () => ({
  sendNativeChatMessage: (...args: unknown[]) => sendNativeChatMessage(...args)
}))

import { useNativeChatPickerCommandDispatch } from './use-native-chat-picker-command-dispatch'

const COMMAND = {
  kind: 'command' as const,
  id: 'command:status',
  name: 'status',
  token: '/status',
  description: 'Show status',
  skillCollision: false
}

function renderDispatch() {
  return renderHook(() =>
    useNativeChatPickerCommandDispatch({
      disabled: false,
      isDispatchingSessionOption: false,
      resolveTarget: () => ({ settings: {}, ptyId: 'pty-1' }),
      sessionOptionsSurface: null,
      trackPendingSend: vi.fn(),
      setHistory: vi.fn((update) => update(EMPTY_HISTORY)),
      setDraft: vi.fn(),
      setCaret: vi.fn(),
      setActiveSuggestion: vi.fn(),
      clearSkillOrigin: vi.fn(),
      clearImageAttachments: vi.fn(),
      setNotice: vi.fn()
    })
  )
}

describe('useNativeChatPickerCommandDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const handle = { cancel: vi.fn(), settleAfterMs: 0 }
    sendNativeChatMessage.mockReturnValue(handle)
  })

  it('pastes autocomplete commands', () => {
    const hook = renderDispatch()
    act(() => hook.result.current(COMMAND))

    expect(sendNativeChatMessage).toHaveBeenCalledWith({}, 'pty-1', '/status')
  })
})
