import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTerminalStartupCommandToken,
  isKnownTuiAgentTerminalStartupCommand,
  TERMINAL_STARTUP_COMMAND_TOKEN_MAX_CHARS
} from './terminal-startup-command-classifier'

afterEach(() => {
  vi.restoreAllMocks()
})

function getRegexWhitespaceSplitCalls(split: ReturnType<typeof vi.spyOn>): unknown[][] {
  return split.mock.calls.filter(
    ([pattern]) => pattern instanceof RegExp && pattern.source === '\\s+'
  )
}

describe('terminal startup command classifier', () => {
  it('extracts the first startup command token without regex whitespace splitting', () => {
    const split = vi.spyOn(String.prototype, 'split')
    const command = [' ', String.fromCharCode(160), 'opencode\t--continue'].join('')

    expect(getTerminalStartupCommandToken(command)).toBe('opencode')
    expect(isKnownTuiAgentTerminalStartupCommand(command)).toBe(true)
    expect(getRegexWhitespaceSplitCalls(split)).toHaveLength(0)
  })

  it('recognizes quoted Windows agent executables', () => {
    const command = '"C:\\Program Files\\Orca\\claude.cmd" --resume'

    expect(getTerminalStartupCommandToken(command)).toBe('C:\\Program Files\\Orca\\claude.cmd')
    expect(isKnownTuiAgentTerminalStartupCommand(command)).toBe(true)
  })

  it('recognizes Orca agent startup commands by executable name only', () => {
    expect(isKnownTuiAgentTerminalStartupCommand('pi --continue')).toBe(true)
    expect(isKnownTuiAgentTerminalStartupCommand('/Users/me/.local/bin/claude --resume abc')).toBe(
      true
    )
    expect(isKnownTuiAgentTerminalStartupCommand('/usr/local/bin/not-claude --resume abc')).toBe(
      false
    )
  })

  it('bounds pathological single-token startup commands', () => {
    const split = vi.spyOn(String.prototype, 'split')
    const command = 'claude'.repeat(TERMINAL_STARTUP_COMMAND_TOKEN_MAX_CHARS)

    expect(getTerminalStartupCommandToken(command)).toHaveLength(
      TERMINAL_STARTUP_COMMAND_TOKEN_MAX_CHARS
    )
    expect(isKnownTuiAgentTerminalStartupCommand(command)).toBe(false)
    expect(getRegexWhitespaceSplitCalls(split)).toHaveLength(0)
  })
})
