import { describe, expect, it } from 'vitest'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from './tui-agent-detection-commands'

describe('tui agent detection commands', () => {
  it('requires Claude before reporting Claude Agent Teams', () => {
    const commands = KNOWN_TUI_AGENT_DETECTION_COMMANDS.filter(
      (command) => command.id === 'claude-agent-teams'
    )

    // Why the aliases: a host installed before the rename carries only the old name.
    expect(commands).toEqual(
      ['girra', 'girra-dev', 'orca', 'orca-dev', 'orca-ide'].map((cmd) => ({
        id: 'claude-agent-teams',
        cmd,
        requiredCommands: ['claude'],
        unsupportedRuntimes: ['win32', 'wsl']
      }))
    )
    expect(getTuiAgentDetectionProbeCommands(commands, 'linux')).toEqual([
      'girra',
      'claude',
      'girra-dev',
      'orca',
      'orca-dev',
      'orca-ide'
    ])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['girra']), 'linux')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['girra', 'claude']), 'linux')).toEqual([
      'claude-agent-teams'
    ])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['orca-ide', 'claude']), 'linux')).toEqual([
      'claude-agent-teams'
    ])
    expect(getTuiAgentDetectionProbeCommands(commands, 'win32')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['girra', 'claude']), 'win32')).toEqual([])
    expect(getTuiAgentDetectionProbeCommands(commands, 'wsl')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['girra', 'claude']), 'wsl')).toEqual([])
  })
})
