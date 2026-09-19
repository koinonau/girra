import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, onMock, removeAllListenersMock, removeHandlerMock, fromWebContentsMock } =
  vi.hoisted(() => ({
    handleMock: vi.fn(),
    onMock: vi.fn(),
    removeAllListenersMock: vi.fn(),
    removeHandlerMock: vi.fn(),
    fromWebContentsMock: vi.fn()
  }))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: fromWebContentsMock
  },
  ipcMain: {
    handle: handleMock,
    on: onMock,
    removeAllListeners: removeAllListenersMock,
    removeHandler: removeHandlerMock
  }
}))

import { registerRuntimeHandlers } from './runtime'

function runtimeCallEvent() {
  const mainFrame = {}
  return {
    sender: {
      id: 1,
      mainFrame,
      on: vi.fn(),
      once: vi.fn()
    },
    senderFrame: mainFrame
  }
}

describe('registerRuntimeHandlers', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeHandlerMock.mockReset()
    fromWebContentsMock.mockReset()
  })

  it('routes sync requests through the authoritative browser window id', () => {
    const runtime = {
      syncWindowGraph: vi.fn().mockReturnValue({ graphStatus: 'ready' }),
      getStatus: vi.fn().mockReturnValue({ graphStatus: 'unavailable' }),
      getRuntimeId: vi.fn().mockReturnValue('runtime-1')
    }

    registerRuntimeHandlers(runtime as never)

    const syncRegistration = handleMock.mock.calls.find(
      ([channel]) => channel === 'runtime:syncWindowGraph'
    )
    expect(syncRegistration).toBeTruthy()

    fromWebContentsMock.mockReturnValue({ id: 17 })

    const currentMainFrame = {}
    const sender = { mainFrame: currentMainFrame }
    const handler = syncRegistration![1]
    const graph = { tabs: [], leaves: [], rendererGeneration: 'renderer-1' }
    const result = handler({ sender, senderFrame: currentMainFrame }, graph)

    expect(runtime.syncWindowGraph).toHaveBeenCalledWith(17, graph)
    expect(result).toEqual({ graphStatus: 'ready' })
  })

  it('rejects a graph publication queued by a superseded main frame', () => {
    const runtime = {
      syncWindowGraph: vi.fn(),
      getStatus: vi.fn(),
      getRuntimeId: vi.fn()
    }
    registerRuntimeHandlers(runtime as never)
    const handler = handleMock.mock.calls.find(
      ([channel]) => channel === 'runtime:syncWindowGraph'
    )![1]
    const sender = { mainFrame: { generation: 2 } }
    fromWebContentsMock.mockReturnValue({ id: 17 })

    expect(() =>
      handler({ sender, senderFrame: { generation: 1 } }, { tabs: [], leaves: [] })
    ).toThrow('Runtime graph sync must originate from the current main frame')
    expect(runtime.syncWindowGraph).not.toHaveBeenCalled()
  })

  it('rejects graph publications without a renderer generation', () => {
    const runtime = { syncWindowGraph: vi.fn() }
    registerRuntimeHandlers(runtime as never)
    const handler = handleMock.mock.calls.find(
      ([channel]) => channel === 'runtime:syncWindowGraph'
    )![1]
    const currentMainFrame = {}
    const sender = { mainFrame: currentMainFrame }
    fromWebContentsMock.mockReturnValue({ id: 17 })

    expect(() =>
      handler({ sender, senderFrame: currentMainFrame }, { tabs: [], leaves: [] })
    ).toThrow('Runtime graph sync requires a renderer generation')
    expect(runtime.syncWindowGraph).not.toHaveBeenCalled()
  })

  it('routes generic local runtime RPC calls through the dispatcher', async () => {
    const runtime = {
      syncWindowGraph: vi.fn(),
      getStatus: vi.fn().mockReturnValue({
        runtimeId: 'runtime-1',
        rendererGraphEpoch: 0,
        graphStatus: 'ready',
        authoritativeWindowId: null,
        liveTabCount: 0,
        liveLeafCount: 0
      }),
      getRuntimeId: vi.fn().mockReturnValue('runtime-1')
    }

    registerRuntimeHandlers(runtime as never)

    const callRegistration = handleMock.mock.calls.find(([channel]) => channel === 'runtime:call')
    expect(callRegistration).toBeTruthy()

    const handler = callRegistration![1]
    const result = await handler(runtimeCallEvent(), { method: 'status.get' })

    expect(result).toMatchObject({
      ok: true,
      result: { runtimeId: 'runtime-1', graphStatus: 'ready' },
      _meta: { runtimeId: 'runtime-1' }
    })
  })

  it('projects Claude structured tabs to the same-version desktop client', async () => {
    const claudeTab = {
      type: 'agent-session',
      id: 'agent-session:claude-1',
      title: 'Claude Chat',
      sessionId: 'claude-1',
      agent: 'claude',
      isActive: true
    }
    const runtime = {
      getRuntimeId: vi.fn().mockReturnValue('runtime-1'),
      getClientSettings: vi.fn(() => ({ experimentalStructuredNativeChat: true })),
      restoreStructuredAgentSessionTabs: vi.fn(async () => undefined),
      listMobileSessionTabs: vi.fn(async () => ({
        worktree: 'workspace-1',
        publicationEpoch: 'epoch-1',
        snapshotVersion: 1,
        activeGroupId: 'group-1',
        activeTabId: claudeTab.id,
        activeTabType: 'agent-session',
        tabGroups: [{ id: 'group-1', activeTabId: claudeTab.id, tabOrder: [claudeTab.id] }],
        tabs: [claudeTab]
      }))
    }

    registerRuntimeHandlers(runtime as never)
    const callRegistration = handleMock.mock.calls.find(([channel]) => channel === 'runtime:call')
    const result = await callRegistration![1](runtimeCallEvent(), {
      method: 'session.tabs.list',
      params: { worktree: 'id:workspace-1' }
    })

    expect(result).toMatchObject({ ok: true, result: { tabs: [claudeTab] } })
  })

  it('registers project group runtime RPC methods for local desktop callers', async () => {
    const runtime = {
      syncWindowGraph: vi.fn(),
      getStatus: vi.fn(),
      getRuntimeId: vi.fn().mockReturnValue('runtime-1'),
      listProjectGroups: vi.fn().mockReturnValue([{ id: 'group-1', name: 'Platform' }])
    }

    registerRuntimeHandlers(runtime as never)

    const callRegistration = handleMock.mock.calls.find(([channel]) => channel === 'runtime:call')
    expect(callRegistration).toBeTruthy()

    const handler = callRegistration![1]
    const result = await handler(runtimeCallEvent(), { method: 'projectGroup.list' })

    expect(result).toMatchObject({
      ok: true,
      result: { groups: [{ id: 'group-1', name: 'Platform' }] },
      _meta: { runtimeId: 'runtime-1' }
    })
  })

  it('registers local runtime streaming subscription lifecycle handlers', () => {
    registerRuntimeHandlers({ syncWindowGraph: vi.fn(), getStatus: vi.fn() } as never)

    expect(handleMock.mock.calls.some(([channel]) => channel === 'runtime:subscribe')).toBe(true)
    expect(onMock.mock.calls.some(([channel]) => channel === 'runtime:unsubscribe')).toBe(true)
    expect(removeAllListenersMock).toHaveBeenCalledWith('runtime:unsubscribe')
  })
})
