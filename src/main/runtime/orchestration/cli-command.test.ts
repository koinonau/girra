import { describe, expect, it } from 'vitest'
import { resolveTerminalOrchestrationCliCommand } from './cli-command'

describe('resolveTerminalOrchestrationCliCommand', () => {
  it('uses the primary command for native and SSH panes', () => {
    expect(resolveTerminalOrchestrationCliCommand({ connectionId: null })).toBe('girra')
    expect(resolveTerminalOrchestrationCliCommand({ connectionId: 'ssh-1' })).toBe('girra')
  })

  it('uses the runtime-provided command locally but never leaks it to SSH', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        runtimeCliCommand: 'girra-dev'
      })
    ).toBe('girra-dev')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: 'ssh-1',
        runtimeCliCommand: 'girra-dev'
      })
    ).toBe('girra')
  })
})
