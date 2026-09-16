import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { flushAsyncTicks } from './pty-connection-test-async'
import {
  VISIBLE_PTY_SETTLE_MS,
  WRAPPER_RESOLVE_RETRY_MS,
  SECOND_WRAPPER_RETRY_MS
} from './pty-connection-test-constants'
import { sendTerminalInputThroughPane } from './pty-connection-test-dom'
import {
  LEAF_1,
  createMockTransport,
  createPane,
  createManager,
  type ConnectCallbacks,
  type MockTransport
} from './pty-connection-test-pane-fixtures'
import {
  resolveMockPaneWindowsShiftEnterEncoding,
  type StoreState
} from './pty-connection-test-store-state'
import { buildPaneConnectionDeps } from './pty-connection-test-deps'
import { createInitialStoreState } from './pty-connection-test-store-fixtures'
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

  it('drops agent status without retaining when OSC 133 reports the command finished', async () => {
    const { connectPanePty } = await import('./pty-connection')

    const capturedDataCallback: { current: ((data: string) => void) | null } = { current: null }
    const transport = createMockTransport()
    let currentPtyId: string | null = null
    vi.mocked(transport.getPtyId).mockImplementation(() => currentPtyId)
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      currentPtyId = 'pty-local-1'
      capturedDataCallback.current = callbacks.onData ?? null
      return 'pty-local-1'
    })
    transportFactoryQueue.push(transport)
    const paneKey = makePaneKey('tab-1', LEAF_1)
    mockStoreState = {
      ...mockStoreState,
      agentStatusByPaneKey: {
        [paneKey]: {
          paneKey,
          state: 'done',
          prompt: 'hi',
          updatedAt: 1000,
          stateStartedAt: 1000,
          agentType: 'opencode',
          stateHistory: []
        }
      }
    }

    const pane = createPane(1)
    const manager = createManager(1)
    const deps = createDeps({ isVisibleRef: { current: false } })

    connectPanePty(pane as never, manager as never, deps as never)

    capturedDataCallback.current?.('\x1b]133;D;130\x07thebr ~/repo $ ')
    await flushAsyncTicks()

    expect(mockStoreState.dropAgentStatus).toHaveBeenCalledWith(paneKey)
    expect(mockStoreState.removeAgentStatus).not.toHaveBeenCalled()
  })

  it('clears pre-hook launch config when a Girra-started command exits', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { connectPanePty } = await import('./pty-connection')
    vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('zsh')

    const capturedDataCallback: { current: ((data: string) => void) | null } = { current: null }
    const transport = createMockTransport()
    let currentPtyId: string | null = null
    vi.mocked(transport.getPtyId).mockImplementation(() => currentPtyId)
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      currentPtyId = 'pty-local-1'
      capturedDataCallback.current = callbacks.onData ?? null
      return 'pty-local-1'
    })
    transportFactoryQueue.push(transport)
    const paneKey = makePaneKey('tab-1', LEAF_1)
    mockStoreState = {
      ...mockStoreState,
      tabsByWorktree: { 'wt-1': [{ id: 'tab-1', ptyId: null }] },
      ptyIdsByTabId: { 'tab-1': [] }
    } as StoreState

    connectPanePty(
      createPane(1) as never,
      createManager(1) as never,
      createDeps({
        startup: {
          command: "claude '--dangerously-skip-permissions'",
          launchConfig: {
            agentArgs: '--dangerously-skip-permissions',
            agentEnv: {}
          },
          launchAgent: 'claude'
        },
        restoredPtyIdByLeafId: {}
      }) as never
    )

    expect(mockStoreState.registerAgentLaunchConfig).toHaveBeenCalledWith(
      paneKey,
      {
        agentArgs: '--dangerously-skip-permissions',
        agentEnv: {}
      },
      expect.objectContaining({ agentType: 'claude' })
    )
    capturedDataCallback.current?.('\x1b]133;D;130\x07thebr ~/repo $ ')
    await flushAsyncTicks()
    await vi.advanceTimersByTimeAsync(350)
    await flushAsyncTicks()

    expect(mockStoreState.clearAgentLaunchConfig).toHaveBeenCalledWith(paneKey)
    expect(mockStoreState.dropAgentStatus).not.toHaveBeenCalled()
  })

  it('routes a manually typed Pi only after foreground enrichment confirms it', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
    const pane = createPane(1)
    const ptyId = 'pty-manually-typed-pi'
    const tabId = 'tab-manually-typed-pi'
    const foregroundResults = ['powershell.exe', 'pi']
    vi.mocked(window.api.pty.confirmForegroundProcess).mockImplementation(async (id: string) =>
      id === ptyId ? (foregroundResults.shift() ?? 'pi') : null
    )
    const transport = createMockTransport(ptyId)
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      dataCallbackRef.current = callbacks.onData ?? null
      return { id: ptyId }
    })
    transportFactoryQueue.push(transport)
    const paneKey = makePaneKey(tabId, LEAF_1)

    connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, isVisibleRef: { current: false } }) as never
    )
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()

    sendTerminalInputThroughPane(pane, 'pi\r')
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

    dataCallbackRef.current?.('\x1b]133;C\x07')
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
    await vi.advanceTimersByTimeAsync(350)
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
    await vi.advanceTimersByTimeAsync(1200)
    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    })
  })

  it('confirms a manually typed Pi without OSC command boundaries', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('pi')
    const pane = createPane(1)
    const ptyId = 'pty-manual-pi-no-osc'
    const tabId = 'tab-manual-pi-no-osc'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, isVisibleRef: { current: false } }) as never
    )
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()

    sendTerminalInputThroughPane(pane, 'pi\r')
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

    await vi.advanceTimersByTimeAsync(350)

    expect(window.api.pty.confirmForegroundProcess).toHaveBeenCalledWith(ptyId)
    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')
  })

  it('confirms a Girra-launched Pi fresh spawn in a no-OSC shell (Git Bash)', async () => {
    // Why: no-OSC shells (Git Bash/cmd) emit no command boundary, so without a fresh-spawn sample the pane never earns routing trust and Shift+Enter regresses to Esc+CR (#7620).
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    vi.mocked(window.api.pty.getForegroundProcess).mockResolvedValue('pi')
    vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('pi')
    const pane = createPane(1)
    const ptyId = 'pty-launched-pi-no-osc'
    const tabId = 'tab-launched-pi-no-osc'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({
        tabId,
        startup: { command: 'pi', launchAgent: 'pi' }
      }) as never
    )
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()
    // The transport reports the fresh spawn; no OSC 133, no typed inference.
    const onPtySpawn = createdTransportOptions[0]?.onPtySpawn as ((id: string) => void) | undefined
    expect(onPtySpawn).toBeTypeOf('function')
    onPtySpawn?.(ptyId)
    await vi.advanceTimersByTimeAsync(
      VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
    )
    await flushAsyncTicks()

    expect(window.api.pty.confirmForegroundProcess).toHaveBeenCalledWith(ptyId)
    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')
  })

  it('trusts a launched Pi whose no-OSC boot only becomes foreground after retries', async () => {
    // Why: the confirmation ladder must span Pi's boot — the shell is still foreground on the first read(s) before Pi takes over.
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    const foregroundResults = ['bash.exe', 'bash.exe', 'pi']
    vi.mocked(window.api.pty.confirmForegroundProcess).mockImplementation(
      async () => foregroundResults.shift() ?? 'pi'
    )
    const pane = createPane(1)
    const ptyId = 'pty-launched-pi-slow-boot'
    const tabId = 'tab-launched-pi-slow-boot'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, startup: { command: 'pi', launchAgent: 'pi' } }) as never
    )
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()
    const onPtySpawn = createdTransportOptions[0]?.onPtySpawn as ((id: string) => void) | undefined
    onPtySpawn?.(ptyId)
    await vi.advanceTimersByTimeAsync(
      VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
    )
    await flushAsyncTicks()

    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')
  })

  it('stays recoverable when a launched Pi outlasts the fresh-spawn confirmation window', async () => {
    // Why: a missed ladder (slow boot) must stay recoverable — latching a shell-confirm would clear launch identity and poison Shift+Enter for the session.
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    let foreground = 'bash.exe'
    vi.mocked(window.api.pty.confirmForegroundProcess).mockImplementation(async () => foreground)
    const pane = createPane(1)
    const ptyId = 'pty-launched-pi-slow'
    const tabId = 'tab-launched-pi-slow'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    const binding = connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, startup: { command: 'pi', launchAgent: 'pi' } }) as never
    ) as unknown as { sampleForegroundAgentOnFocus: () => void }
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()
    const onPtySpawn = createdTransportOptions[0]?.onPtySpawn as ((id: string) => void) | undefined
    onPtySpawn?.(ptyId)
    // Whole ladder elapses while the shell is still foreground (Pi not up yet).
    await vi.advanceTimersByTimeAsync(350 + 1200 + 6000)
    await flushAsyncTicks()

    // Benign miss: shell never latched as foreground; encoding still safe fallback.
    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: null,
      shellForeground: false
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

    // Pi finally boots and a focus event re-samples: trust is recoverable.
    foreground = 'pi'
    binding.sampleForegroundAgentOnFocus()
    await vi.advanceTimersByTimeAsync(350 + 1200 + 6000)
    await flushAsyncTicks()

    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')
  })

  it('revokes trusted Pi after accepted no-OSC exit input until shell confirmation', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('cmd.exe')
    const pane = createPane(1)
    const ptyId = 'pty-pi-exit-no-osc'
    const tabId = 'tab-pi-exit-no-osc'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    connectPanePty(pane as never, createManager(1) as never, createDeps({ tabId }) as never)
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()
    mockStoreState.paneForegroundAgentByPaneKey[paneKey] = {
      agent: 'pi',
      routingTrusted: true,
      shellForeground: false
    }

    sendTerminalInputThroughPane(pane, '\x03')
    await flushAsyncTicks()

    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: 'pi',
      routingRevoked: true,
      routingConfirmationPending: true,
      shellForeground: false
    })
    // The provider read is asynchronous; keep the last known safe capability
    // so a second Shift+Enter cannot become Pi's submit chord in the gap.
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')

    await vi.advanceTimersByTimeAsync(350 + 1200 + 6000)

    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: null,
      shellForeground: true
    })
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
  })

  it('trusts Pi in a no-OSC shell and retires routing after accepted exit input', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    let foreground = 'pi'
    vi.mocked(window.api.pty.getForegroundProcess).mockResolvedValue('pi')
    vi.mocked(window.api.pty.confirmForegroundProcess).mockImplementation(async () => foreground)
    const pane = createPane(1)
    const ptyId = 'pty-pi-no-osc-lifecycle'
    const tabId = 'tab-pi-no-osc-lifecycle'
    const paneKey = makePaneKey(tabId, LEAF_1)
    transportFactoryQueue.push(createMockTransport(ptyId))

    const binding = connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, startup: { command: 'pi', launchAgent: 'pi' } }) as never
    ) as unknown as { requestWindowsShiftEnterReconfirmation: () => void }
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()
    const onPtySpawn = createdTransportOptions[0]?.onPtySpawn as ((id: string) => void) | undefined
    onPtySpawn?.(ptyId)
    await vi.advanceTimersByTimeAsync(
      VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
    )
    await flushAsyncTicks()

    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')

    binding.requestWindowsShiftEnterReconfirmation()
    await vi.advanceTimersByTimeAsync(200)
    binding.requestWindowsShiftEnterReconfirmation()
    await vi.advanceTimersByTimeAsync(700)
    await flushAsyncTicks()
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')

    foreground = 'cmd.exe'
    sendTerminalInputThroughPane(pane, '\x03')
    await flushAsyncTicks()
    // A provider read is pending; do not turn the next Pi Shift+Enter into submit.
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('csi-u')
    await vi.advanceTimersByTimeAsync(
      VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
    )
    await flushAsyncTicks()

    expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
      agent: null,
      shellForeground: true
    })
  })

  it('never promotes typed Pi text when foreground enrichment is unavailable', async () => {
    vi.useFakeTimers()
    const { connectPanePty } = await import('./pty-connection')
    vi.mocked(window.api.pty.confirmForegroundProcess)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('inspection unavailable'))
      .mockResolvedValueOnce(null)
    const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
    const pane = createPane(1)
    const ptyId = 'pty-typed-pi-unavailable-start'
    const tabId = 'tab-typed-pi-unavailable-start'
    const paneKey = makePaneKey(tabId, LEAF_1)
    const transport = createMockTransport(ptyId)
    transport.connect.mockImplementation(async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
      dataCallbackRef.current = callbacks.onData ?? null
      return { id: ptyId }
    })
    transportFactoryQueue.push(transport)

    connectPanePty(
      pane as never,
      createManager(1) as never,
      createDeps({ tabId, isVisibleRef: { current: false } }) as never
    )
    await vi.advanceTimersByTimeAsync(20)
    await flushAsyncTicks()

    sendTerminalInputThroughPane(pane, 'pi\r')
    dataCallbackRef.current?.('\x1b]133;C\x07')
    await vi.advanceTimersByTimeAsync(350)
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

    await vi.advanceTimersByTimeAsync(1200)
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

    await vi.advanceTimersByTimeAsync(5999)
    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
    await vi.advanceTimersByTimeAsync(1)

    expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
  })
})
