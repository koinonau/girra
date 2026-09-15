import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

const PTY_ID_LOCAL = 'pty-1'
const PTY_ID_SSH = 'ssh:target-1@@pty-9'
const TAB_ID = 'tab-1'
const WORKTREE_ID = 'repo-1::/tmp/wt-1'
const PANE_KEY = `${TAB_ID}:11111111-1111-4111-8111-111111111111`

type MockStoreState = {
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  dropAgentStatus: ReturnType<typeof vi.fn>
  clearAgentLaunchConfig: ReturnType<typeof vi.fn>
}

let mockStoreState: MockStoreState
const dispatchTerminalCommandFinishedEvent = vi.fn()

vi.mock('@/store', () => ({
  useAppStore: { getState: () => mockStoreState }
}))
vi.mock('@/hooks/terminal-command-finished-event', () => ({
  dispatchTerminalCommandFinishedEvent
}))

function makeMockStoreState(): MockStoreState {
  return {
    agentStatusByPaneKey: {},
    dropAgentStatus: vi.fn(),
    clearAgentLaunchConfig: vi.fn()
  }
}

function makeStatusEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'build the feature',
    agentType: 'claude',
    updatedAt: 1000,
    stateStartedAt: 1000,
    ...overrides
  } as AgentStatusEntry
}

async function createPolicy(ptyId: string) {
  const { createParkedTerminalCommandStatusPolicy } =
    await import('./parked-terminal-command-status')
  return createParkedTerminalCommandStatusPolicy({
    ptyId,
    worktreeId: WORKTREE_ID,
    paneKey: PANE_KEY
  })
}

describe('createParkedTerminalCommandStatusPolicy', () => {
  beforeEach(() => {
    vi.resetModules()
    dispatchTerminalCommandFinishedEvent.mockClear()
    mockStoreState = makeMockStoreState()
  })

  it('nudges git UI on command finished for every PTY class', async () => {
    const local = await createPolicy(PTY_ID_LOCAL)
    local.onCommandFinished(0)
    local.dispose()
    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.onCommandFinished(0)
    ssh.dispose()

    expect(dispatchTerminalCommandFinishedEvent).toHaveBeenCalledTimes(2)
    expect(dispatchTerminalCommandFinishedEvent).toHaveBeenCalledWith(WORKTREE_ID, 0)
  })

  it('drops a same-turn status row on command finished for SSH PTYs only', async () => {
    mockStoreState.agentStatusByPaneKey[PANE_KEY] = makeStatusEntry()
    const local = await createPolicy(PTY_ID_LOCAL)
    local.onCommandFinished(0)
    // Why: local drops need the mounted pane's foreground process-confirm ladder
    // (leaked nested-shell 133;D protection), so the watcher must not drop them.
    expect(mockStoreState.dropAgentStatus).not.toHaveBeenCalled()
    local.dispose()

    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.onCommandFinished(0)
    expect(mockStoreState.dropAgentStatus).toHaveBeenCalledWith(PANE_KEY)
    ssh.dispose()
  })

  it('clears the launch registry on SSH command finished when no status row exists', async () => {
    const ssh = await createPolicy(PTY_ID_SSH)

    ssh.onCommandFinished(0)

    expect(mockStoreState.clearAgentLaunchConfig).toHaveBeenCalledWith(PANE_KEY)
    expect(mockStoreState.dropAgentStatus).not.toHaveBeenCalled()
    ssh.dispose()
  })

  it('does nothing after dispose', async () => {
    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.dispose()

    ssh.onCommandFinished(0)

    expect(dispatchTerminalCommandFinishedEvent).not.toHaveBeenCalled()
    expect(mockStoreState.dropAgentStatus).not.toHaveBeenCalled()
  })
})
