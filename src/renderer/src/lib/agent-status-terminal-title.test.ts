import { describe, expect, it } from 'vitest'
import { resolveAgentStatusTerminalTitle } from './agent-status-terminal-title'

describe('resolveAgentStatusTerminalTitle', () => {
  it('replaces stale Pi spinner titles when hook state finishes', () => {
    expect(resolveAgentStatusTerminalTitle({ agentType: 'pi', state: 'done' }, '\u2839 Pi')).toBe(
      'Pi ready'
    )
  })

  it('keeps descriptive completed titles that are already non-working', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'pi', state: 'done' }, 'Orca Pi Done')
    ).toBe('Orca Pi Done')
  })

  it('uses permission titles for synthetic agents waiting on user input', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'pi', state: 'waiting' }, '\u280b Pi')
    ).toBe('Pi - action required')
  })

  it('clears stale permission titles when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'pi', state: 'done' }, 'Pi - action required')
    ).toBe('Pi ready')
  })

  it('replaces stale Codex spinner titles when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, '\u280b Codex')
    ).toBe('Codex ready')
  })

  it('uses permission titles for Codex when hook state waits on user input', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'waiting' }, '\u280b Codex')
    ).toBe('Codex - action required')
  })

  it('preserves native OpenCode titles through hook status transitions', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'done' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'waiting' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
  })

  it('does not invent an OpenCode title when no native title exists', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'opencode', state: 'done' }, undefined)
    ).toBeUndefined()
  })
})
