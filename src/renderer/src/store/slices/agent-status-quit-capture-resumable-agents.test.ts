import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { createTestStore, makeTab } from './store-test-helpers'

describe('quit-time capture for newly resumable agents', () => {
  it('checkpoints a live OpenCode provider session before quit-time capture', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      }
    } as Partial<AppState>)

    store.getState().setAgentStatus(
      'tab-1:leaf-1',
      {
        state: 'working',
        prompt: 'finish the task',
        agentType: 'opencode'
      },
      'OpenCode',
      { updatedAt: 10, stateStartedAt: 10 },
      { tabId: 'tab-1', worktreeId: 'wt-1' },
      {
        providerSession: {
          key: 'session_id',
          id: 'session_431324d7-2165-42f0-9ecd-9f93437b3201'
        }
      }
    )

    // Why: without the agent in RESUMABLE_TUI_AGENTS no sleeping record is captured,
    // so restart drops the session instead of resuming it.
    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      agent: 'opencode',
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      providerSession: { key: 'session_id', id: 'session_431324d7-2165-42f0-9ecd-9f93437b3201' },
      origin: 'live'
    })
  })
})
