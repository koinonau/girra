import { describe, expect, it } from 'vitest'
import {
  buildManagedHookDetectionCommands,
  detectedManagedHookAgents
} from './managed-hook-detection-commands'

describe('managed hook detection commands', () => {
  it('omits disabled agents and includes safe command overrides', () => {
    const commands = buildManagedHookDetectionCommands(
      {
        disabledTuiAgents: ['opencode'],
        agentCmdOverrides: { claude: '/opt/claude custom' }
      },
      'linux'
    )

    expect(commands).toContainEqual({ id: 'claude', cmd: '/opt/claude' })
    expect(
      buildManagedHookDetectionCommands({ disabledTuiAgents: ['claude'] }, 'linux').some(
        (command) => command.id === 'claude'
      )
    ).toBe(false)
  })

  it('maps detected TUI ids back to managed hook targets', () => {
    expect(detectedManagedHookAgents(['claude', 'opencode', 'droid'])).toEqual(['claude'])
  })
})
