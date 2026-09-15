import { describe, it, expect } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { resolveNativeChatSession } from './native-chat-pane-resolution'

function entry(
  overrides: Partial<AgentStatusEntry> & Pick<AgentStatusEntry, 'paneKey'>
): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    stateHistory: [],
    ...overrides
  }
}

describe('resolveNativeChatSession', () => {
  it('resolves a pane with a captured Claude session', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        agentStatusEntry: entry({
          paneKey,
          agentType: 'claude',
          providerSession: { key: 'session_id', id: 'sess-abc' }
        }),
        ptyId: 'pty-1'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'sess-abc',
      transcriptPath: null,
      ptyId: 'pty-1',
      paneKey
    })
  })

  it('surfaces the hook transcriptPath when the providerSession carries one', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        agentStatusEntry: entry({
          paneKey,
          agentType: 'claude',
          providerSession: {
            key: 'session_id',
            id: 'sess-abc',
            transcriptPath: '/home/u/.claude/projects/slug/real-uuid.jsonl'
          }
        }),
        ptyId: 'pty-1'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'sess-abc',
      transcriptPath: '/home/u/.claude/projects/slug/real-uuid.jsonl',
      ptyId: 'pty-1',
      paneKey
    })
  })

  it('resolves a just-launched pane with sessionId null', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        // Entry exists (agent launched) but no providerSession reported yet.
        agentStatusEntry: entry({ paneKey, agentType: 'claude' }),
        ptyId: 'pty-1'
      })
    ).toEqual({ agent: 'claude', sessionId: null, transcriptPath: null, ptyId: 'pty-1', paneKey })
  })

  it('resolves two split leaves independently to their own values', () => {
    const leftKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    const rightKey = 'tab-1:22222222-2222-4222-8222-222222222222'
    const left = resolveNativeChatSession({
      paneKey: leftKey,
      launchAgent: 'claude',
      agentStatusEntry: entry({
        paneKey: leftKey,
        agentType: 'claude',
        providerSession: { key: 'session_id', id: 'left-sess' }
      }),
      ptyId: 'pty-left'
    })
    const right = resolveNativeChatSession({
      paneKey: rightKey,
      launchAgent: 'claude',
      agentStatusEntry: entry({
        paneKey: rightKey,
        agentType: 'claude',
        providerSession: { key: 'session_id', id: 'right-sess' }
      }),
      ptyId: 'pty-right'
    })
    expect(left).toEqual({
      agent: 'claude',
      sessionId: 'left-sess',
      transcriptPath: null,
      ptyId: 'pty-left',
      paneKey: leftKey
    })
    expect(right).toEqual({
      agent: 'claude',
      sessionId: 'right-sess',
      transcriptPath: null,
      ptyId: 'pty-right',
      paneKey: rightKey
    })
  })

  it('derives a supported agent from the status entry when no launchAgent is set', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: null,
        agentStatusEntry: entry({
          paneKey,
          agentType: 'claude',
          providerSession: { key: 'session_id', id: 'claude-1' }
        }),
        ptyId: 'pty-1'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'claude-1',
      transcriptPath: null,
      ptyId: 'pty-1',
      paneKey
    })
  })

  it('resolves a supported title fallback when no hook or launch identity exists', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: null,
        resolvedAgent: 'claude',
        ptyId: 'pty-1'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: null,
      transcriptPath: null,
      ptyId: 'pty-1',
      paneKey
    })
  })

  it('does not resolve an unsupported title fallback', () => {
    expect(
      resolveNativeChatSession({
        paneKey: 'tab-1:11111111-1111-4111-8111-111111111111',
        launchAgent: null,
        resolvedAgent: 'opencode',
        ptyId: 'pty-1'
      })
    ).toBeNull()
  })

  it('does not resolve an unsupported live status entry', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: null,
        agentStatusEntry: entry({
          paneKey,
          agentType: 'opencode',
          providerSession: { key: 'session_id', id: 'g-1' }
        }),
        ptyId: 'pty-1'
      })
    ).toBeNull()
  })

  it('does not fall back to a supported title agent when live status is unsupported', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: null,
        agentStatusEntry: entry({
          paneKey,
          agentType: 'opencode',
          providerSession: { key: 'session_id', id: 'g-1' }
        }),
        resolvedAgent: 'claude',
        ptyId: 'pty-1'
      })
    ).toBeNull()
  })

  it('does not fall back to a supported launch agent when live status is unsupported', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        agentStatusEntry: entry({
          paneKey,
          agentType: 'opencode',
          providerSession: { key: 'session_id', id: 'g-1' }
        }),
        resolvedAgent: 'claude',
        ptyId: 'pty-1'
      })
    ).toBeNull()
  })

  it('keeps launch identity ahead of the title fallback', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        resolvedAgent: 'opencode',
        ptyId: 'pty-1'
      })?.agent
    ).toBe('claude')
  })

  it('keeps live hook identity and provider session ahead of the title fallback', () => {
    const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
    expect(
      resolveNativeChatSession({
        paneKey,
        launchAgent: 'claude',
        agentStatusEntry: entry({
          paneKey,
          agentType: 'claude',
          providerSession: { key: 'session_id', id: 'claude-live' }
        }),
        resolvedAgent: 'opencode',
        ptyId: 'pty-1'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'claude-live',
      transcriptPath: null,
      ptyId: 'pty-1',
      paneKey
    })
  })

  it('returns null for a non-agent pane (no launchAgent, no entry)', () => {
    expect(
      resolveNativeChatSession({
        paneKey: 'tab-1:11111111-1111-4111-8111-111111111111',
        launchAgent: null,
        ptyId: 'pty-1'
      })
    ).toBeNull()
  })
})
