// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearNativeChatModelEnrichmentForTests } from './native-chat-session-option-enrichment'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  createNativeChatPtySessionOptions: vi.fn(),
  discoverNativeChatCatalogModels: vi.fn()
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: mocks.callRuntimeRpc
}))

vi.mock('./native-chat-pty-session-options', () => ({
  createNativeChatPtySessionOptions: mocks.createNativeChatPtySessionOptions
}))

vi.mock('./native-chat-session-option-discovery', () => ({
  resolveNativeChatModelDiscoveryContext: () => ({ hostKey: 'local', runtime: {} }),
  discoverNativeChatCatalogModels: mocks.discoverNativeChatCatalogModels
}))

const { useNativeChatSessionOptions } = await import('./use-native-chat-session-options')

const LOCAL_TARGET = { kind: 'local' } as const

describe('useNativeChatSessionOptions pick persistence', () => {
  const mountPane = (): void => {
    renderHook(() =>
      useNativeChatSessionOptions({
        agent: 'claude',
        terminalTabId: 'tab-1',
        targetPtyId: 'pty-1',
        dispatchCommand: () => undefined
      })
    )
  }

  beforeEach(() => {
    clearNativeChatModelEnrichmentForTests()
    mocks.callRuntimeRpc.mockReset().mockResolvedValue({ ok: true })
    mocks.discoverNativeChatCatalogModels.mockReset().mockResolvedValue(null)
    // A stable snapshot reference: useSyncExternalStore re-renders forever otherwise.
    const emptySnapshot: never[] = []
    mocks.createNativeChatPtySessionOptions.mockReset().mockImplementation(() => ({
      subscribe: () => () => {},
      getSnapshot: () => emptySnapshot,
      recordOutgoingCommand: () => {},
      reportSessionOptions: () => {},
      replaceModels: () => {}
    }))
  })

  it('keeps PTY picks in the client settings record used by paired launches', async () => {
    mountPane()
    const persistSelection = mocks.createNativeChatPtySessionOptions.mock.calls[0]?.[0]
      ?.persistSelection as
      | ((pick: {
          modelId: string
          optionId: string
          value: string
          adoptModelAsLaunchDefault: boolean
        }) => Promise<void>)
      | undefined

    await persistSelection?.({
      modelId: 'opus',
      optionId: 'effort',
      value: 'high',
      adoptModelAsLaunchDefault: true
    })

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      LOCAL_TARGET,
      'settings.mutateNativeChatSessionOptions',
      expect.objectContaining({ type: 'apply-picks', agent: 'claude' })
    )
  })
})
