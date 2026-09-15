import { describe, expect, it } from 'vitest'
import { WINDOWS_GIT_BASH_SHELL } from '../../../src/shared/windows-terminal-shell'
import { buildFakeAgentCommandOverride } from './fake-agent-command-override'

describe('buildFakeAgentCommandOverride', () => {
  it('invokes a quoted Windows command path through PowerShell', () => {
    expect(
      buildFakeAgentCommandOverride("C:\\Users\\Jane Doe\\Temp\\fake agent's\\claude.cmd", 'win32')
    ).toBe("& 'C:\\Users\\Jane Doe\\Temp\\fake agent''s\\claude.cmd'")
  })

  it('quotes a POSIX command path', () => {
    expect(buildFakeAgentCommandOverride("/tmp/fake agent's/claude", 'darwin')).toBe(
      "'/tmp/fake agent'\"'\"'s/claude'"
    )
  })

  it('drops the PowerShell call operator when the Windows host runs cmd', () => {
    expect(
      buildFakeAgentCommandOverride('C:\\Temp\\fake agent\\claude.cmd', 'win32', 'cmd.exe')
    ).toBe('"C:\\Temp\\fake agent\\claude.cmd"')
  })

  it('uses POSIX quoting when the Windows host runs Git Bash or WSL', () => {
    expect(buildFakeAgentCommandOverride('/tmp/fake agent/claude', 'win32', 'wsl.exe')).toBe(
      "'/tmp/fake agent/claude'"
    )
    expect(
      buildFakeAgentCommandOverride("/tmp/fake agent's/claude", 'win32', WINDOWS_GIT_BASH_SHELL)
    ).toBe("'/tmp/fake agent'\"'\"'s/claude'")
  })
})
