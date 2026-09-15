import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../orca-runtime-test-mocks.spec'
import type { TerminalLayoutSnapshot } from '../orca-runtime-test-mocks.spec'
import { TEST_WORKTREE_ID, TEST_WORKTREE_PATH, store } from '../orca-runtime-test-fixtures.spec'

describe('OrcaRuntimeService', () => {
  it('allows non-Claude foreground agents after preserved Claude agents management evidence', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-bg' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => 'opencode',
      listProcesses: async () => [{ id: 'pty-bg', cwd: TEST_WORKTREE_PATH, title: 'zsh' }]
    })
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, { tabs: [], leaves: [] })
    const { handle } = await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      command: 'claude agents',
      title: 'claude agents'
    })

    await runtime.getWorktreePs()

    await expect(runtime.isTerminalRunningAgent(handle)).resolves.toBe(true)
  })

  it('does not let stale PTY status override a fresh neutral PTY title', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-bg' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, { tabs: [], leaves: [] })
    const { handle } = await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      command: 'claude',
      title: 'Claude working'
    })
    runtime.onPtyData('pty-bg', '\x1b]0;Claude working\x07', 100)
    runtime.onPtyData('pty-bg', '\x1b]0;zsh\x07', 101)

    await expect(runtime.isTerminalRunningAgent(handle)).resolves.toBe(false)
  })

  it('does not use stale runtime-created PTY status when a neutral PTY title exists', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-bg' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, { tabs: [], leaves: [] })
    const { handle } = await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      command: 'claude',
      title: 'zsh'
    })
    const pty = (
      runtime as unknown as {
        ptysById: Map<
          string,
          {
            lastAgentStatus: 'working' | null
          }
        >
      }
    ).ptysById.get('pty-bg')
    expect(pty).toBeDefined()
    if (!pty) {
      throw new Error('expected runtime PTY record')
    }
    pty.lastAgentStatus = 'working'
    runtime.setPtyController(null)

    await expect(runtime.isTerminalRunningAgent(handle)).resolves.toBe(false)
  })

  it('does not classify agent-named workspace paths or titles', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          title: '/tmp/opencode-workspace',
          activeLeafId: 'pane:1',
          layout: null
        }
      ],
      leaves: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          leafId: 'pane:1',
          paneRuntimeId: 1,
          ptyId: 'pty-1',
          paneTitle: '/tmp/opencode-workspace'
        }
      ]
    })
    runtime.onPtyData('pty-1', 'cd /tmp/opencode-workspace\n', 100)
    const [terminal] = (await runtime.listTerminals()).terminals

    await expect(runtime.isTerminalRunningAgent(terminal.handle)).resolves.toBe(false)
  })

  it('keeps mobile terminal surfaces visible while their leaf handle is pending', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [],
      leaves: [],
      mobileSessionTabs: [
        {
          worktree: TEST_WORKTREE_ID,
          publicationEpoch: 'epoch-1',
          snapshotVersion: 1,
          activeGroupId: 'group-1',
          activeTabId: 'tab-1::pane:1',
          activeTabType: 'terminal',
          tabs: [
            {
              type: 'terminal',
              id: 'tab-1::pane:1',
              parentTabId: 'tab-1',
              leafId: 'pane:1',
              title: 'Terminal 1',
              isActive: true
            }
          ]
        }
      ]
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(result.tabs).toEqual([
      expect.objectContaining({
        type: 'terminal',
        id: 'tab-1::pane:1',
        parentTabId: 'tab-1',
        leafId: 'pane:1',
        status: 'pending-handle',
        terminal: null
      })
    ])
  })

  it('keeps mobile terminal surfaces pending while a live leaf has no PTY', async () => {
    const runtime = new OrcaRuntimeService(store)
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          title: 'Terminal 1',
          activeLeafId: 'pane:1',
          layout: null
        }
      ],
      leaves: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          leafId: 'pane:1',
          paneRuntimeId: 1,
          ptyId: null,
          paneTitle: 'Terminal 1'
        }
      ],
      mobileSessionTabs: [
        {
          worktree: TEST_WORKTREE_ID,
          publicationEpoch: 'epoch-1',
          snapshotVersion: 1,
          activeGroupId: 'group-1',
          activeTabId: 'tab-1::pane:1',
          activeTabType: 'terminal',
          tabs: [
            {
              type: 'terminal',
              id: 'tab-1::pane:1',
              parentTabId: 'tab-1',
              leafId: 'pane:1',
              title: 'Terminal 1',
              isActive: true
            }
          ]
        }
      ]
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(result.tabs).toEqual([
      expect.objectContaining({
        type: 'terminal',
        id: 'tab-1::pane:1',
        status: 'pending-handle',
        terminal: null
      })
    ])
  })

  it('selects a visible active pane when terminal visual layout prunes a stale leaf', async () => {
    const runtime = new OrcaRuntimeService(store)
    const parentLayout: TerminalLayoutSnapshot = {
      root: {
        type: 'split',
        direction: 'vertical',
        first: { type: 'leaf', leafId: 'pane:1' },
        second: { type: 'leaf', leafId: 'pane:2' }
      },
      activeLeafId: 'pane:1',
      expandedLeafId: null,
      ptyIdsByLeafId: { 'pane:2': 'pty-2' }
    }
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          title: 'Split terminal',
          activeLeafId: 'pane:1',
          layout: null
        }
      ],
      leaves: [
        {
          tabId: 'tab-1',
          worktreeId: TEST_WORKTREE_ID,
          leafId: 'pane:2',
          paneRuntimeId: 2,
          ptyId: 'pty-2',
          paneTitle: 'Live pane'
        }
      ],
      mobileSessionTabs: [
        {
          worktree: TEST_WORKTREE_ID,
          publicationEpoch: 'epoch-1',
          snapshotVersion: 1,
          activeGroupId: 'group-1',
          activeTabId: 'tab-1::pane:1',
          activeTabType: 'terminal',
          tabGroups: [
            {
              id: 'group-1',
              activeTabId: 'missing-tab',
              tabOrder: ['missing-tab', 'tab-1']
            }
          ],
          tabs: [
            {
              type: 'terminal',
              id: 'tab-1::pane:1',
              parentTabId: 'tab-1',
              leafId: 'pane:1',
              title: 'Stale pane',
              parentLayout,
              isActive: true
            },
            {
              type: 'terminal',
              id: 'tab-1::pane:2',
              parentTabId: 'tab-1',
              leafId: 'pane:2',
              title: 'Live pane',
              parentLayout,
              isActive: false
            }
          ]
        }
      ]
    })

    const result = await runtime.listTerminals(`id:${TEST_WORKTREE_ID}`)

    expect(result.visualLayouts).toMatchObject([
      {
        worktreeId: TEST_WORKTREE_ID,
        root: {
          type: 'group',
          activeTabId: 'tab-1',
          tabs: [
            {
              tabId: 'tab-1',
              activeLeafId: 'pane:2',
              panes: {
                type: 'terminal',
                leafId: 'pane:2',
                active: true
              }
            }
          ]
        }
      }
    ])
  })

  it('omits stale browser session tabs that no longer have live webContents', async () => {
    const runtime = new OrcaRuntimeService(store)
    const tabList = vi.fn(() => ({
      tabs: [
        {
          browserPageId: 'browser-page-live',
          index: 0,
          url: 'https://live.example/',
          title: 'Live Browser',
          active: true
        }
      ]
    }))
    runtime.setAgentBrowserBridge({ tabList } as never)
    runtime.attachWindow(1)
    runtime.syncWindowGraph(1, {
      tabs: [],
      leaves: [],
      mobileSessionTabs: [
        {
          worktree: TEST_WORKTREE_ID,
          publicationEpoch: 'epoch-1',
          snapshotVersion: 1,
          activeGroupId: 'group-1',
          activeTabId: 'browser-unified-stale',
          activeTabType: 'browser',
          tabs: [
            {
              type: 'browser',
              id: 'browser-unified-stale',
              title: 'Dead Browser',
              browserWorkspaceId: 'browser-workspace-stale',
              browserPageId: 'browser-page-stale',
              url: 'about:blank',
              loading: false,
              canGoBack: false,
              canGoForward: false,
              isActive: true
            },
            {
              type: 'browser',
              id: 'browser-unified-live',
              title: 'Stale Title',
              browserWorkspaceId: 'browser-workspace-live',
              browserPageId: 'browser-page-live',
              url: 'https://stale.example/',
              loading: false,
              canGoBack: false,
              canGoForward: false,
              isActive: false
            }
          ]
        }
      ]
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(tabList).toHaveBeenCalledWith(TEST_WORKTREE_ID)
    expect(result.tabs).toEqual([
      expect.objectContaining({
        type: 'browser',
        id: 'browser-unified-live',
        browserPageId: 'browser-page-live',
        url: 'https://live.example/',
        title: 'Live Browser',
        isActive: true
      })
    ])
    expect(result.activeTabId).toBe('browser-unified-live')
    expect(result.activeTabType).toBe('browser')
  })
})
