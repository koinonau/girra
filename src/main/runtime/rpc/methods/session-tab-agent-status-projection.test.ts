import { describe, expect, it } from 'vitest'
import {
  AGENT_SESSION_BOUNDARY_RUNTIME_CAPABILITY,
  CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
} from '../../../../shared/protocol-version'
import type { RuntimeMobileSessionTabsSnapshot } from '../../../../shared/runtime-types'
import { projectSessionTabAgentStatus } from './session-tab-agent-status-projection'

function makeSnapshot(sessionBoundary: boolean): RuntimeMobileSessionTabsSnapshot {
  return {
    worktree: 'wt-1',
    publicationEpoch: 'epoch-1',
    snapshotVersion: 1,
    activeGroupId: null,
    activeTabId: 'tab-1::leaf-1',
    activeTabType: 'terminal',
    tabs: [
      {
        type: 'terminal',
        id: 'tab-1::leaf-1',
        title: 'Claude',
        parentTabId: 'tab-1',
        leafId: 'leaf-1',
        isActive: true,
        agentStatus: {
          state: 'done',
          prompt: '',
          updatedAt: 100,
          stateStartedAt: 100,
          paneKey: 'tab-1:leaf-1',
          stateHistory: [],
          sessionBoundary
        }
      }
    ]
  }
}

const structuredCapabilities = [
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
  CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
]

describe('projectSessionTabAgentStatus', () => {
  it('projects structured tabs and dangling group focus out of old clients', () => {
    const snapshot: RuntimeMobileSessionTabsSnapshot = {
      ...makeSnapshot(false),
      activeGroupId: 'group-a',
      activeTabId: 'agent-session:session-a',
      activeTabType: 'agent-session',
      tabGroups: [
        {
          id: 'group-a',
          activeTabId: 'agent-session:session-a',
          tabOrder: ['tab-1::leaf-1', 'agent-session:session-a'],
          recentTabIds: ['agent-session:session-a', 'tab-1::leaf-1']
        },
        {
          id: 'group-b',
          activeTabId: 'agent-session:session-b',
          tabOrder: ['agent-session:session-b']
        }
      ],
      tabGroupLayout: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'group-a' },
        second: { type: 'leaf', groupId: 'group-b' }
      },
      tabs: [
        { ...makeSnapshot(false).tabs[0]!, isActive: false },
        {
          type: 'agent-session',
          id: 'agent-session:session-a',
          title: 'Claude Chat',
          sessionId: 'session-a',
          agent: 'claude',
          isActive: true
        },
        {
          type: 'agent-session',
          id: 'agent-session:session-b',
          title: 'Claude Chat',
          sessionId: 'session-b',
          agent: 'claude',
          isActive: false
        }
      ]
    }
    // A paired client that never negotiated the capability, with the setting on, loses the rows.
    const oldClient = projectSessionTabAgentStatus(snapshot, 'runtime', [], true)
    expect(oldClient.tabs.map((tab) => tab.type)).toEqual(['terminal'])
    expect(oldClient.activeTabId).toBe('tab-1::leaf-1')
    expect(oldClient.activeTabType).toBe('terminal')
    expect(oldClient.tabs[0]?.isActive).toBe(true)
    expect(oldClient.tabGroups?.[0]?.tabOrder).toEqual(['tab-1::leaf-1'])
    expect(oldClient.tabGroups).toHaveLength(1)
    expect(oldClient.tabGroupLayout).toEqual({ type: 'leaf', groupId: 'group-a' })

    const capable = projectSessionTabAgentStatus(snapshot, 'runtime', structuredCapabilities, true)
    expect(capable).toBe(snapshot)

    // The host setting is policy for every caller, so a capable desktop client with the
    // setting off sees the same projection an old client does.
    expect(
      projectSessionTabAgentStatus(snapshot, 'runtime', structuredCapabilities, false)
    ).toEqual(oldClient)
    expect(projectSessionTabAgentStatus(snapshot, undefined, undefined, false)).toEqual(oldClient)
  })

  const claudeSnapshot = {
    ...makeSnapshot(false),
    tabs: [
      makeSnapshot(false).tabs[0]!,
      {
        type: 'agent-session',
        id: 'agent-session:claude',
        title: 'Claude Chat',
        sessionId: 'claude',
        agent: 'claude',
        isActive: false
      }
    ],
    activeGroupId: 'group-a',
    tabGroups: [
      { id: 'group-a', activeTabId: 'tab-1::leaf-1', tabOrder: ['tab-1::leaf-1'] },
      { id: 'group-b', activeTabId: 'agent-session:claude', tabOrder: ['agent-session:claude'] }
    ],
    tabGroupLayout: {
      type: 'split',
      direction: 'horizontal',
      first: { type: 'leaf', groupId: 'group-a' },
      second: { type: 'leaf', groupId: 'group-b' }
    }
  } as unknown as RuntimeMobileSessionTabsSnapshot

  it('withholds Claude rows from a paired runtime client that never negotiated them', () => {
    const projected = projectSessionTabAgentStatus(
      claudeSnapshot,
      'runtime',
      [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
      true
    )

    expect(projected.tabs.map((tab) => tab.id)).toEqual(['tab-1::leaf-1'])
    // A row pruned from `tabs` but left in the layout is its own dead tab.
    expect(projected.tabGroups?.map((group) => group.id)).toEqual(['group-a'])
    expect(projected.tabGroupLayout).toEqual({ type: 'leaf', groupId: 'group-a' })
    expect(projected.activeGroupId).toBe('group-a')
    expect(projected.activeTabId).toBe('tab-1::leaf-1')
    expect(projected.activeTabType).toBe('terminal')
  })

  it('does not treat the Claude capability as a substitute for the base structured capability', () => {
    const projected = projectSessionTabAgentStatus(
      claudeSnapshot,
      'runtime',
      [CLAUDE_STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
      true
    )

    expect(projected.tabs.map((tab) => tab.type)).toEqual(['terminal'])
  })

  // Why: the host setting is policy, so no negotiated capability can reveal a chat it is not serving.
  it('withholds every structured row when the desktop experiment is off', () => {
    for (const capabilities of [
      [],
      [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
      structuredCapabilities
    ]) {
      const projected = projectSessionTabAgentStatus(claudeSnapshot, 'runtime', capabilities, false)
      expect(projected.tabs.map((tab) => tab.type)).toEqual(['terminal'])
    }
  })

  it('publishes Claude rows to a paired runtime client that negotiated them', () => {
    const projected = projectSessionTabAgentStatus(
      claudeSnapshot,
      'runtime',
      structuredCapabilities,
      true
    )

    expect(projected).toBe(claudeSnapshot)
    expect(projected.tabGroupLayout).toEqual(claudeSnapshot.tabGroupLayout)
  })

  it('keeps Claude rows on the local renderer, which negotiates nothing', () => {
    expect(projectSessionTabAgentStatus(claudeSnapshot, undefined, undefined, true)).toBe(
      claudeSnapshot
    )
    expect(projectSessionTabAgentStatus(claudeSnapshot, undefined, [], true)).toBe(claudeSnapshot)
  })

  it('withholds session boundaries from legacy paired clients', () => {
    const projected = projectSessionTabAgentStatus(makeSnapshot(true), 'runtime', [], true)

    expect(projected.tabs[0]).not.toHaveProperty('agentStatus')
  })

  it('publishes session boundaries to clients that negotiated them', () => {
    const snapshot = makeSnapshot(true)

    expect(
      projectSessionTabAgentStatus(
        snapshot,
        'runtime',
        [AGENT_SESSION_BOUNDARY_RUNTIME_CAPABILITY],
        true
      )
    ).toBe(snapshot)
  })

  it('does not alter local or real-completion projections', () => {
    const localBoundary = makeSnapshot(true)
    const runtimeCompletion = makeSnapshot(false)

    expect(projectSessionTabAgentStatus(localBoundary, undefined, undefined, true)).toBe(
      localBoundary
    )
    expect(projectSessionTabAgentStatus(runtimeCompletion, 'runtime', [], true)).toBe(
      runtimeCompletion
    )
  })
})
