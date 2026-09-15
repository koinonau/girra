import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from './server'
import { createShedSubagentsField } from '../../shared/agent-hook-relay'
import { PANE } from './server.test-fixtures'

beforeEach(() => {
  _internals.resetCachesForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AgentHookServer listener replay', () => {
  it('restores a subagent roster the relay shed to fit the frame', () => {
    const server = new AgentHookServer()
    const roster = [
      { id: 'reviewer-1', agentType: 'reviewer', state: 'working' as const, startedAt: 1 }
    ]
    server.ingestRemote(
      {
        paneKey: PANE,
        payload: { state: 'working', prompt: 'review', agentType: 'claude', subagents: roster }
      },
      'conn-1'
    )
    // The relay dropped the roster to fit an oversized frame and said so on the wire.
    server.ingestRemote(
      {
        paneKey: PANE,
        shedFields: ['lastAssistantMessage', createShedSubagentsField(roster)],
        payload: { state: 'done', prompt: 'review', agentType: 'claude' }
      },
      'conn-1'
    )
    expect(server.getStatusSnapshot()[0]).toMatchObject({ state: 'done', subagents: roster })
  })

  it('lets an unmarked absent roster clear, so a finished team still retires', () => {
    const server = new AgentHookServer()
    server.ingestRemote(
      {
        paneKey: PANE,
        payload: {
          state: 'working',
          prompt: 'review',
          agentType: 'claude',
          subagents: [{ id: 'reviewer-1', agentType: 'reviewer', state: 'working', startedAt: 1 }]
        }
      },
      'conn-1'
    )
    server.ingestRemote(
      { paneKey: PANE, payload: { state: 'done', prompt: 'review', agentType: 'claude' } },
      'conn-1'
    )
    expect(server.getStatusSnapshot()[0]?.subagents).toBeUndefined()
  })

  it('does not carry Claude background work across connection cleanup', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    try {
      const server = new AgentHookServer()
      server.ingestRemote(
        {
          paneKey: PANE,
          claudeRunningNonAgentTask: true,
          payload: { state: 'working', prompt: 'old host', agentType: 'claude' }
        },
        'conn-1'
      )

      server.clearStatusEntriesForConnection('conn-1')
      server.ingestRemote(
        {
          paneKey: PANE,
          payload: { state: 'working', prompt: 'new host', agentType: 'claude' }
        },
        'conn-2'
      )
      const baseline = server.getStatusSnapshot()[0]
      vi.setSystemTime(1_500)

      expect(
        server.inferInterrupt({
          paneKey: PANE,
          baselineUpdatedAt: baseline.receivedAt,
          baselineStateStartedAt: baseline.stateStartedAt,
          baselinePrompt: 'new host',
          baselineAgentType: 'claude',
          intent: 'plain-escape'
        })
      ).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
