import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { flushAsyncTicks } from './pty-connection-test-async'
import { sendTerminalInputThroughPane } from './pty-connection-test-dom'
import {
  LEAF_1,
  createMockTransport,
  createPane,
  createManager,
  type MockTransport
} from './pty-connection-test-pane-fixtures'
import { buildPaneConnectionDeps } from './pty-connection-test-deps'
import {
  createInitialStoreState,
  buildActiveRuntimeEnvironmentState
} from './pty-connection-test-store-fixtures'
import type { StoreState } from './pty-connection-test-store-state'
import {
  installTerminalTestGlobals,
  restoreTerminalTestGlobals
} from './pty-connection-test-environment'

const {
  resetAndRefreshAllTerminalWebglAtlases,
  scheduleTerminalWebglAtlasRecovery,
  scheduleRuntimeGraphSync,
  shouldSeedCacheTimerOnInitialTitle,
  toastInfo
} = vi.hoisted(() => ({
  resetAndRefreshAllTerminalWebglAtlases: vi.fn(),
  scheduleTerminalWebglAtlasRecovery: vi.fn(),
  scheduleRuntimeGraphSync: vi.fn(),
  shouldSeedCacheTimerOnInitialTitle: vi.fn(() => false),
  toastInfo: vi.fn()
}))

let mockStoreState: StoreState
let transportFactoryQueue: MockTransport[] = []
let createdTransportOptions: Record<string, unknown>[] = []
let storeSubscribers: ((state: StoreState) => void)[] = []

vi.mock('@/runtime/sync-runtime-graph', () => ({
  scheduleRuntimeGraphSync
}))

vi.mock('@/lib/pane-manager/pane-manager-registry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resetAndRefreshAllTerminalWebglAtlases
}))

vi.mock('./terminal-webgl-atlas-recovery', () => ({
  scheduleTerminalWebglAtlasRecovery
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mockStoreState,
    subscribe: (listener: (state: StoreState) => void) => {
      storeSubscribers.push(listener)
      return () => {
        storeSubscribers = storeSubscribers.filter((candidate) => candidate !== listener)
      }
    }
  }
}))

vi.mock('@/lib/agent-status', async (importOriginal) => {
  const { buildAgentStatusModuleMock } = await import('./pty-connection-test-environment')
  return buildAgentStatusModuleMock(await importOriginal<Record<string, unknown>>())
})

vi.mock('./cache-timer-seeding', () => ({
  shouldSeedCacheTimerOnInitialTitle
}))

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo
  }
}))

// Why: the working→idle test invokes the real useNotificationDispatch hook outside React, so useCallback must pass through (safe suite-wide: no test here renders React).
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return {
    ...actual,
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn
  }
})

vi.mock('./pty-transport', () => ({
  createIpcPtyTransport: vi.fn((options: Record<string, unknown>) => {
    createdTransportOptions.push(options)
    const nextTransport = transportFactoryQueue.shift()
    if (!nextTransport) {
      throw new Error('No mock transport queued')
    }
    return nextTransport
  })
}))

vi.mock('./remote-runtime-pty-transport', () => ({
  createRemoteRuntimePtyTransport: vi.fn(
    (_environmentId: string, options: Record<string, unknown>) => {
      createdTransportOptions.push(options)
      const nextTransport = transportFactoryQueue.shift()
      if (!nextTransport) {
        throw new Error('No mock transport queued')
      }
      return nextTransport
    }
  )
}))

// Why: stub only getEagerPtyBufferHandle so tests can simulate a live eager buffer (adopt path) without standing up the real IPC dispatcher.
vi.mock('./pty-dispatcher', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getEagerPtyBufferHandle: vi.fn(() => undefined)
  }
})

function createDeps(overrides: Record<string, unknown> = {}) {
  return buildPaneConnectionDeps(() => mockStoreState, overrides)
}

// Why: activeRuntimeEnvironmentId exercises the remote-runtime path where the renderer still owns OSC 9999 status.
function enableActiveRuntimeEnvironment(environmentId = 'env-1'): void {
  mockStoreState = buildActiveRuntimeEnvironmentState(mockStoreState, environmentId)
}

describe('connectPanePty', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    transportFactoryQueue = []
    createdTransportOptions = []
    storeSubscribers = []
    mockStoreState = createInitialStoreState(() => mockStoreState)
    installTerminalTestGlobals()
  })

  afterEach(async () => {
    await restoreTerminalTestGlobals()
  })

  it('drives runtime title, tab title, and renderer policy from one title decision', async () => {
    const { connectPanePty } = await import('./pty-connection')
    const pane = createPane(1)
    const transport = createMockTransport('pty-title-decision')
    transportFactoryQueue.push(transport)
    const manager = createManager(1, 1)
    const deps = createDeps()

    connectPanePty(pane as never, manager as never, deps as never)
    await flushAsyncTicks()
    const onTitleChange = createdTransportOptions[0]?.onTitleChange as
      | ((title: string, rawTitle: string) => void)
      | undefined
    if (!onTitleChange) {
      throw new Error('missing title callback')
    }
    onTitleChange('\u2733 Claude Code', '\u2733 Claude Code')

    expect(deps.setRuntimePaneTitle).toHaveBeenCalledWith('tab-1', 1, '\u2733 Claude Code')
    expect(deps.updateTabTitle).toHaveBeenCalledWith('tab-1', '\u2733 Claude Code')
    expect(manager.setPaneGpuRendering).toHaveBeenCalledWith(1, true)
  })

  it('does not let one split pane title change another pane GPU state', async () => {
    const { connectPanePty } = await import('./pty-connection')
    const pane1 = createPane(1)
    const pane2 = createPane(2)
    const transport1 = createMockTransport('pty-split-1')
    const transport2 = createMockTransport('pty-split-2')
    transportFactoryQueue.push(transport1, transport2)
    const manager = createManager(2, 1)

    connectPanePty(pane1 as never, manager as never, createDeps() as never)
    connectPanePty(pane2 as never, manager as never, createDeps() as never)
    await flushAsyncTicks()
    const onTitleChange1 = createdTransportOptions[0]?.onTitleChange as
      | ((title: string, rawTitle: string) => void)
      | undefined
    if (!onTitleChange1) {
      throw new Error('missing title callback for split pane 1')
    }
    onTitleChange1('\u2733 Claude Code', '\u2733 Claude Code')

    const gpuCalls = manager.setPaneGpuRendering.mock.calls as [number, boolean][]
    expect(gpuCalls.some(([paneId]) => paneId === 1)).toBe(true)
    expect(gpuCalls.every(([paneId]) => paneId !== 2)).toBe(true)
  })

  it('keeps Pi-compatible remote runtime status as Pi after typed pi command', async () => {
    const { connectPanePty } = await import('./pty-connection')
    enableActiveRuntimeEnvironment()
    const paneKey = makePaneKey('tab-1', LEAF_1)
    const pane = createPane(1)
    const transport = createMockTransport('remote:web-env-1@@pty-pi')
    transportFactoryQueue.push(transport)
    const manager = createManager(1, 1)
    const deps = createDeps()

    connectPanePty(pane as never, manager as never, deps as never)
    sendTerminalInputThroughPane(pane, 'pi\r')
    await flushAsyncTicks()
    const onTitleChange = createdTransportOptions[0]?.onTitleChange as
      | ((title: string, rawTitle: string) => void)
      | undefined
    const onAgentStatus = createdTransportOptions[0]?.onAgentStatus as
      | ((payload: { state: 'done'; prompt: string; agentType: 'pi' }) => void)
      | undefined
    if (!onTitleChange || !onAgentStatus) {
      throw new Error('missing remote PTY callbacks')
    }
    onTitleChange('Pi ready', 'Pi ready')
    onAgentStatus({
      state: 'done',
      prompt: '',
      agentType: 'pi'
    })

    expect(transport.sendInput).toHaveBeenCalledWith('pi\r')
    expect(deps.setRuntimePaneTitle).toHaveBeenCalledWith('tab-1', 1, 'Pi ready')
    expect(deps.updateTabTitle).toHaveBeenCalledWith('tab-1', 'Pi ready')
    expect(mockStoreState.agentStatusByPaneKey[paneKey]).toMatchObject({
      state: 'done',
      agentType: 'pi',
      terminalTitle: 'Pi ready'
    })
  })
})
