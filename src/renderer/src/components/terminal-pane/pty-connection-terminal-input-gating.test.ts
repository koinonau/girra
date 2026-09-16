import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { flushAsyncTicks } from './pty-connection-test-async'
import {
  createKeyboardEventTarget,
  keyEvent,
  sendTerminalInputThroughPane
} from './pty-connection-test-dom'
import {
  LEAF_1,
  createMockTransport,
  createPane,
  createManager,
  type ConnectCallbacks,
  type MockTransport
} from './pty-connection-test-pane-fixtures'
import { buildPaneConnectionDeps } from './pty-connection-test-deps'
import { createInitialStoreState } from './pty-connection-test-store-fixtures'
import type { StoreState } from './pty-connection-test-store-state'
import {
  installTerminalTestGlobals,
  restoreTerminalTestGlobals
} from './pty-connection-test-environment'

/** What remountTerminalTabForRecovery answers now that it reports admission. */
const REMOUNTED = { remounted: true as const, generation: 1 }
const AUTOMATIC_REQUEST = expect.objectContaining({ trigger: 'automatic' })

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

  it('does not infer interrupts when the transport rejects terminal input', async () => {
    const { connectPanePty } = await import('./pty-connection')

    vi.useFakeTimers()
    vi.setSystemTime(1_100)
    const transport = createMockTransport('pty-disconnected')
    transport.sendInput.mockReturnValue(false)
    transportFactoryQueue.push(transport)
    const paneKey = makePaneKey('tab-1', LEAF_1)
    mockStoreState.agentStatusByPaneKey[paneKey] = {
      paneKey,
      state: 'working',
      prompt: 'disconnected input',
      updatedAt: 1_000,
      stateStartedAt: 900,
      agentType: 'opencode',
      stateHistory: []
    }

    const pane = createPane(1)
    const terminalTarget = createKeyboardEventTarget()
    ;(pane.terminal as { element?: unknown }).element = terminalTarget.target
    let onDataHandler: ((data: string) => void) | null = null
    pane.terminal.onData = vi.fn(((handler: (data: string) => void) => {
      onDataHandler = handler
      return { dispose: vi.fn() }
    }) as typeof pane.terminal.onData)

    connectPanePty(pane as never, createManager(1) as never, createDeps() as never)

    if (!onDataHandler) {
      throw new Error('expected onData handler to be registered')
    }
    terminalTarget.dispatch(keyEvent({ key: 'c', ctrlKey: true }))
    ;(onDataHandler as unknown as (data: string) => void)('\x03')
    vi.advanceTimersByTime(500)

    expect(transport.sendInput).toHaveBeenCalledWith('\x03')
    expect(window.api.agentStatus.inferInterrupt).not.toHaveBeenCalled()
  })

  it('does not infer interrupts when the main process rejects acknowledged input', async () => {
    const { connectPanePty } = await import('./pty-connection')

    vi.useFakeTimers()
    vi.setSystemTime(1_100)
    const transport = createMockTransport('pty-reject-race')
    transport.sendInputAccepted = vi.fn().mockResolvedValue(false)
    transportFactoryQueue.push(transport)
    const paneKey = makePaneKey('tab-1', LEAF_1)
    mockStoreState.agentStatusByPaneKey[paneKey] = {
      paneKey,
      state: 'working',
      prompt: 'reject race input',
      updatedAt: 1_000,
      stateStartedAt: 900,
      agentType: 'opencode',
      stateHistory: []
    }

    const pane = createPane(1)
    const terminalTarget = createKeyboardEventTarget()
    ;(pane.terminal as { element?: unknown }).element = terminalTarget.target
    let onDataHandler: ((data: string) => void) | null = null
    pane.terminal.onData = vi.fn(((handler: (data: string) => void) => {
      onDataHandler = handler
      return { dispose: vi.fn() }
    }) as typeof pane.terminal.onData)

    connectPanePty(pane as never, createManager(1) as never, createDeps() as never)

    if (!onDataHandler) {
      throw new Error('expected onData handler to be registered')
    }
    terminalTarget.dispatch(keyEvent({ key: 'c', ctrlKey: true }))
    ;(onDataHandler as unknown as (data: string) => void)('\x03')
    await flushAsyncTicks()
    vi.advanceTimersByTime(500)

    expect(transport.sendInputAccepted).toHaveBeenCalledWith('\x03')
    expect(transport.sendInput).not.toHaveBeenCalled()
    expect(window.api.agentStatus.inferInterrupt).not.toHaveBeenCalled()
  })

  it('remounts a connected pane when main reports its daemon write unavailable', async () => {
    const { connectPanePty } = await import('./pty-connection')
    const { _resetTerminalPaneRecoveryForTests } = await import('./terminal-pane-recovery')
    _resetTerminalPaneRecoveryForTests()
    const remountTerminalTabForRecovery = vi.fn(() => REMOUNTED)
    mockStoreState = { ...mockStoreState, remountTerminalTabForRecovery } as StoreState
    const transport = createMockTransport('daemon-pty')
    let writeUnavailable: (() => void) | undefined
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      writeUnavailable = callbacks.onWriteUnavailable
      return { id: 'daemon-pty' }
    })
    transportFactoryQueue.push(transport)

    connectPanePty(createPane(1) as never, createManager(1) as never, createDeps() as never)
    await flushAsyncTicks(6)
    writeUnavailable?.()
    await flushAsyncTicks(6)

    expect(window.api.pty.hasPty).toHaveBeenCalledWith('daemon-pty')
    expect(remountTerminalTabForRecovery).toHaveBeenCalledWith('tab-1', AUTOMATIC_REQUEST)
    _resetTerminalPaneRecoveryForTests()
  })

  it('quarantines the interrupted line after a write-unavailable remount, but never device replies', async () => {
    const { connectPanePty } = await import('./pty-connection')
    const { _resetTerminalPaneRecoveryForTests } = await import('./terminal-pane-recovery')
    _resetTerminalPaneRecoveryForTests()
    const remountTerminalTabForRecovery = vi.fn(() => REMOUNTED)
    mockStoreState = { ...mockStoreState, remountTerminalTabForRecovery } as StoreState
    const transport = createMockTransport('daemon-pty')
    let writeUnavailable: (() => void) | undefined
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      writeUnavailable = callbacks.onWriteUnavailable
      return { id: 'daemon-pty' }
    })
    transportFactoryQueue.push(transport)
    const pane = createPane(1)

    connectPanePty(pane as never, createManager(1) as never, createDeps() as never)
    await flushAsyncTicks(6)
    writeUnavailable?.()
    await flushAsyncTicks(6)
    expect(remountTerminalTabForRecovery).toHaveBeenCalledWith('tab-1', AUTOMATIC_REQUEST)

    // The surviving tail of `echo hi; rm -rf x`: reaching the fresh shell would
    // let the user's own Enter run `rm -rf x` (#10065 follow-up).
    sendTerminalInputThroughPane(pane, 'cho hi; rm -rf x')
    expect(transport.sendInput).not.toHaveBeenCalledWith('cho hi; rm -rf x')
    // A program that queries during reattach hangs if its reply is dropped.
    sendTerminalInputThroughPane(pane, '\x1b[3;1R')
    expect(transport.sendInputImmediate).toHaveBeenCalledWith('\x1b[3;1R')
    sendTerminalInputThroughPane(pane, '\r')
    expect(transport.sendInput).not.toHaveBeenCalledWith('\r')
    // The terminator disarmed it, so the next real command reaches the shell.
    sendTerminalInputThroughPane(pane, 'ls\r')
    expect(transport.sendInput).toHaveBeenCalledWith('ls\r')
    _resetTerminalPaneRecoveryForTests()
  })

  it('recovers a wedged write pipeline after accepted input without renderer output', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    const { settleTerminalWriteStallWatch, WRITE_PIPELINE_STALL_CHECK_MS } =
      await import('@/lib/pane-manager/terminal-write-pipeline-health')
    const remountTerminalTabForRecovery = vi.fn(() => REMOUNTED)
    mockStoreState = { ...mockStoreState, remountTerminalTabForRecovery } as StoreState
    const transport = createMockTransport('pty-wedged')
    transportFactoryQueue.push(transport)
    const pane = createPane(1)
    const binding = connectPanePty(pane as never, createManager(1) as never, createDeps() as never)
    await flushAsyncTicks()
    pane.terminal.write.mockClear()
    pane.terminal.write.mockImplementation(() => {})

    sendTerminalInputThroughPane(pane, 'x')
    settleTerminalWriteStallWatch(pane.terminal)
    vi.advanceTimersByTime(WRITE_PIPELINE_STALL_CHECK_MS * 2)
    await flushAsyncTicks()

    expect(transport.sendInput).toHaveBeenCalledWith('x')
    expect(pane.terminal.write).toHaveBeenCalledWith('', expect.any(Function))
    expect(remountTerminalTabForRecovery).toHaveBeenCalledWith('tab-1', AUTOMATIC_REQUEST)
    binding.dispose()
  })

  it('does not arm the wedge probe when acknowledged input is rejected', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    const { WRITE_PIPELINE_STALL_CHECK_MS } =
      await import('@/lib/pane-manager/terminal-write-pipeline-health')
    const transport = createMockTransport('pty-rejected')
    transport.sendInputAccepted = vi.fn().mockResolvedValue(false)
    transportFactoryQueue.push(transport)
    const pane = createPane(1)
    const binding = connectPanePty(pane as never, createManager(1) as never, createDeps() as never)
    await flushAsyncTicks()
    pane.terminal.write.mockClear()
    pane.terminal.write.mockImplementation(() => {})

    sendTerminalInputThroughPane(pane, '\x03')
    await flushAsyncTicks()
    vi.advanceTimersByTime(WRITE_PIPELINE_STALL_CHECK_MS * 2)
    await flushAsyncTicks()

    expect(transport.sendInputAccepted).toHaveBeenCalledWith('\x03')
    expect(pane.terminal.write).not.toHaveBeenCalledWith('', expect.any(Function))
    binding.dispose()
  })
})
