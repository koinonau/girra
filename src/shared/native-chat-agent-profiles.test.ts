import { describe, expect, it } from 'vitest'
import {
  getHostClaimedNativeChatCommands,
  getNativeChatAgentProfile,
  getTextDrivenNativeChatCommands
} from './native-chat-agent-profiles'

describe('native chat agent picker profiles', () => {
  it('reads Claude skills from Claude-owned roots', () => {
    expect(getNativeChatAgentProfile('claude')).toMatchObject({ skillSourceOwner: 'claude' })
  })

  it('does not grant custom or unverified agents a skill grammar', () => {
    expect(getNativeChatAgentProfile('custom-agent')).toBeNull()
  })
})

describe('host-claimed native chat commands', () => {
  function names(agent: string): string[] {
    return getHostClaimedNativeChatCommands(agent).map((command) => command.name)
  }

  // Claude's harness expands a slash command out of the message body, so claiming
  // its catalog only answered "/init is not available" for commands that do run.
  it('claims nothing from the Claude catalog', () => {
    expect(names('claude')).toEqual([])
    expect(getTextDrivenNativeChatCommands('claude')).toEqual([])
  })

  it('claims the whole catalog for agents with no pass-through policy', () => {
    expect(names('custom-agent')).toEqual(['clear', 'help'])
  })
})
