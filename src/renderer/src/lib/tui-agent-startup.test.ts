import { describe, expect, it } from 'vitest'
import {
  buildAgentDraftLaunchPlan,
  buildAgentStartupPlan,
  isShellProcess
} from './tui-agent-startup'

const emptyLaunchConfig = (agentCommand: string) => ({
  agentCommand,
  agentArgs: '',
  agentEnv: {}
})

describe('buildAgentStartupPlan', () => {
  it('passes Claude prompts as a positional interactive argument', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'claude',
        prompt: 'Fix the bug',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "claude 'Fix the bug'",
      expectedProcess: 'claude',
      followupPrompt: null,
      launchConfig: emptyLaunchConfig('claude')
    })
  })

  it('passes OpenCode prompts through its prompt flag', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'opencode',
        prompt: 'Investigate this regression',
        cmdOverrides: {},
        platform: 'linux'
      })
    ).toEqual({
      agent: 'opencode',
      launchCommand: "opencode --prompt 'Investigate this regression'",
      expectedProcess: 'opencode',
      followupPrompt: null,
      launchConfig: emptyLaunchConfig('opencode')
    })
  })

  it('launches Claude Agent Teams first and injects the draft prompt after startup', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'claude-agent-teams',
        prompt: 'Refactor the parser',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'claude-agent-teams',
      launchCommand: 'orca claude-teams',
      expectedProcess: 'claude',
      followupPrompt: 'Refactor the parser',
      launchConfig: emptyLaunchConfig('orca claude-teams')
    })
  })

  it('applies command overrides without changing the prompt syntax contract', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'pi',
        prompt: 'Ship the fix',
        cmdOverrides: { pi: '/opt/pi/bin/pi' },
        platform: 'linux'
      })
    ).toEqual({
      agent: 'pi',
      launchCommand: "/opt/pi/bin/pi 'Ship the fix'",
      expectedProcess: 'pi',
      followupPrompt: null,
      launchConfig: emptyLaunchConfig('/opt/pi/bin/pi')
    })
  })

  it('returns null when there is no prompt to inject', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'claude',
        prompt: '   ',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })
})

describe('buildAgentDraftLaunchPlan', () => {
  it('uses Claude --prefill to seed the input box without submitting', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "claude --prefill 'https://github.com/acme/repo/issues/42'",
      expectedProcess: 'claude',
      launchConfig: emptyLaunchConfig('claude')
    })
  })

  it('returns null for agents without a documented prefill flag', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'opencode',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })

  it('uses ORCA_PI_PREFILL env var for pi (no CLI flag exists)', () => {
    // Why: pi has no `--prefill` flag, and bracketed-paste-after-ready races
    // against pi's lengthy startup output. The Girra overlay installs an
    // `orca-prefill` extension that reads ORCA_PI_PREFILL on session_start
    // and seeds the editor. Plan plumbs the env var without polluting the
    // shell command (no `FOO='...' pi` prefix typed into the terminal).
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'pi',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'pi',
      launchCommand: `pi; command test -n "$fish_pid" && set --erase -g ORCA_PI_PREFILL; command test -z "$fish_pid" && unset ORCA_PI_PREFILL; true`,
      expectedProcess: 'pi',
      env: { ORCA_PI_PREFILL: 'https://github.com/acme/repo/issues/42' },
      launchConfig: emptyLaunchConfig('pi')
    })
  })

  it('returns null for an empty draft so callers fall back cleanly', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: '   ',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })

  it('honors cmdOverrides so custom Claude install paths still prefill', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'review this',
        cmdOverrides: { claude: '/opt/anthropic/bin/claude' },
        platform: 'linux'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "/opt/anthropic/bin/claude --prefill 'review this'",
      expectedProcess: 'claude',
      launchConfig: emptyLaunchConfig('/opt/anthropic/bin/claude')
    })
  })
})

describe('isShellProcess', () => {
  it('treats common shells as non-agent foreground processes', () => {
    expect(isShellProcess('bash')).toBe(true)
    expect(isShellProcess('C:\\Program Files\\Git\\bin\\bash.exe')).toBe(true)
    expect(isShellProcess('pwsh.exe')).toBe(true)
    expect(isShellProcess('/bin/zsh')).toBe(true)
    expect(isShellProcess('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')).toBe(
      true
    )
    expect(isShellProcess('')).toBe(true)
  })

  it('does not confuse agent processes with the host shell', () => {
    expect(isShellProcess('opencode')).toBe(false)
    expect(isShellProcess('claude')).toBe(false)
  })
})
