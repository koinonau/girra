import { describe, expect, it, vi } from 'vitest'
import {
  dispatchStructuredAgentSessionComposerCommand,
  isStructuredAgentSessionComposerCommand,
  structuredSlashCommands
} from './structured-agent-session-composer'

describe('structuredSlashCommands', () => {
  const hostController = {
    snapshot: [],
    invokeAction: async () => true,
    setOption: async () => true,
    conversationCommands: ['clear', 'compact'] as const,
    runConversationCommand: async () => ({ accepted: true, error: null })
  }
  const REFUSAL = /is not available in chat sessions/

  // The composer menu and the dispatcher read the same policy: every offered row is
  // honored, either answered by the host or passed through to the agent.
  it.each(['claude'] as const)(
    'offers %s only commands the host answers or the agent runs',
    async (agent) => {
      const offered = structuredSlashCommands(['clear', 'compact'], agent)
      expect(offered.length).toBeGreaterThan(0)
      for (const command of offered) {
        const outcome = await dispatchStructuredAgentSessionComposerCommand(`/${command.name}`, {
          ...hostController,
          agent
        })
        expect(outcome.error ?? '').not.toMatch(REFUSAL)
      }
    }
  )

  it('adds nothing for an agent whose own harness expands its commands', () => {
    expect(structuredSlashCommands(['clear', 'compact'], 'claude').map((c) => c.name)).toEqual([
      'model',
      'effort',
      'clear',
      'compact'
    ])
  })

  it('offers only the commands a chat session can carry out', () => {
    expect(structuredSlashCommands().map((command) => command.name)).toEqual(['model', 'effort'])
  })
  it('adds only implemented host-supported conversation commands', () => {
    expect(structuredSlashCommands(['clear', 'compact']).map((command) => command.name)).toEqual([
      'model',
      'effort',
      'clear',
      'compact'
    ])
    expect(structuredSlashCommands(['compact']).map((command) => command.name)).toEqual([
      'model',
      'effort',
      'compact'
    ])
  })
})

describe('isStructuredAgentSessionComposerCommand', () => {
  // The menu hides TUI-only commands, but the guard must still claim a typed one
  // so it is answered here instead of sent to the model as prose.
  it.each([
    ['claude', 'compact'],
    ['claude', 'clear']
  ] as const)('claims the unoffered %s command /%s', (agent, name) => {
    expect(isStructuredAgentSessionComposerCommand(`/${name}`, agent)).toBe(true)
  })

  it('leaves an unknown token to the chat path', () => {
    expect(isStructuredAgentSessionComposerCommand('/my-skill', 'claude')).toBe(false)
  })
})

describe('dispatchStructuredAgentSessionComposerCommand', () => {
  const controller = {
    agent: 'claude' as const,
    snapshot: [],
    invokeAction: async () => true,
    setOption: async () => true
  }

  it.each(['claude'] as const)(
    'handles %s conversation commands without message fallthrough',
    async (agent) => {
      const runConversationCommand = vi.fn(async () => ({ accepted: true, error: null }))
      for (const command of ['clear', 'compact'] as const) {
        const result = await dispatchStructuredAgentSessionComposerCommand(`/${command}`, {
          ...controller,
          agent,
          conversationCommands: ['clear', 'compact'],
          runConversationCommand
        })
        expect(result).toEqual({ handled: true, accepted: true, error: null })
        expect(runConversationCommand).toHaveBeenLastCalledWith(command)
      }
    }
  )
  it('retains a draft on unsupported hosts and rejects arguments before dispatch', async () => {
    expect(await dispatchStructuredAgentSessionComposerCommand('/clear', controller)).toMatchObject(
      { handled: true, accepted: false, error: '/clear is not supported by this chat host.' }
    )
    const runConversationCommand = vi.fn()
    expect(
      await dispatchStructuredAgentSessionComposerCommand('/compact keep this', {
        ...controller,
        conversationCommands: ['compact'],
        runConversationCommand
      })
    ).toMatchObject({ handled: true, accepted: false })
    expect(runConversationCommand).not.toHaveBeenCalled()
  })
})

describe('agent-implemented commands pass through to the agent', () => {
  const controller = {
    snapshot: [],
    invokeAction: async () => true,
    setOption: async () => true
  }
  const PASSED_THROUGH = { handled: false, accepted: false, error: null }

  // Claude's harness runs a slash command it finds in the message text, so
  // claiming these answered "not available" for commands that do work.
  it.each(['init', 'review', 'help'] as const)(
    'sends /%s on to the Claude harness instead of refusing it',
    async (name) => {
      expect(isStructuredAgentSessionComposerCommand(`/${name}`, 'claude')).toBe(false)
      expect(
        await dispatchStructuredAgentSessionComposerCommand(`/${name}`, {
          ...controller,
          agent: 'claude'
        })
      ).toEqual(PASSED_THROUGH)
    }
  )

  it.each(['clear', 'compact', 'model', 'effort'] as const)(
    'still claims the host-owned /%s on Claude',
    async (name) => {
      expect(isStructuredAgentSessionComposerCommand(`/${name}`, 'claude')).toBe(true)
      expect(
        (
          await dispatchStructuredAgentSessionComposerCommand(`/${name}`, {
            ...controller,
            agent: 'claude'
          })
        ).handled
      ).toBe(true)
    }
  )
})
