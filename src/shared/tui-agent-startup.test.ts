import { describe, expect, it } from 'vitest'
import {
  buildAgentDraftLaunchPlan,
  buildAgentResumeStartupPlan,
  buildAgentStartupPlan,
  buildShellCommandFromArgv,
  planAgentCliArgsSuffix
} from './tui-agent-startup'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import { normalizeTuiAgentArgsRecord, resolveTuiAgentLaunchArgs } from './tui-agent-launch-defaults'

describe('draft prefill teardown ordering (#14975)', () => {
  // Why pinned: the teardown mutates the calling shell, so it must reference
  // $fish_pid, which aborts the line under `set -u`. That is survivable ONLY
  // because it runs AFTER the agent — the agent is already up. Moving it before
  // the command would make an aborted line a blocked launch, which is exactly
  // what reverted #14863.
  it('runs the clear after the agent command, never before it', () => {
    const plan = buildAgentDraftLaunchPlan({
      agent: 'pi',
      draft: 'hello',
      cmdOverrides: {},
      platform: 'darwin'
    })

    const command = plan?.launchCommand ?? ''
    expect(command.indexOf('pi')).toBeLessThan(command.indexOf('fish_pid'))
    expect(command).toMatch(/^pi;/)
  })
})

describe('tui agent startup plans', () => {
  it.each(['powershell', 'cmd'] as const)(
    'keeps the established invalid-quote error on %s',
    (shell) => {
      expect(planAgentCliArgsSuffix('--model "unterminated', shell)).toEqual({
        ok: false,
        error: 'CLI arguments are invalid: Unclosed quote in command template.'
      })
    }
  )

  it('uses POSIX quoting when the target shell is Linux', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: "fix Bob's branch",
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude 'fix Bob'\"'\"'s branch'")
  })

  it('uses PowerShell quoting by default when the target shell is Windows', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix Bob\'s "quoted" branch',
      cmdOverrides: {},
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("claude 'fix Bob''s \"quoted\" branch'")
  })

  it('invokes fully quoted argv commands in PowerShell', () => {
    expect(buildShellCommandFromArgv(['claude', '--resume', 's1'], 'powershell')).toBe(
      "& 'claude' '--resume' 's1'"
    )
  })

  it('uses cmd escaping when requested explicitly', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix "quoted" & %PATH%',
      cmdOverrides: {},
      platform: 'win32',
      shell: 'cmd'
    })

    expect(plan?.launchCommand).toBe('claude "fix ^"quoted^" ^& ^%PATH^%"')
  })

  it('passes a flag-shaped prompt to argv agents as a quoted token', () => {
    const plan = buildAgentStartupPlan({
      agent: 'pi',
      prompt: '--version',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("pi '--version'")
  })

  it('keeps argv prompt startup on the fast delivery path', () => {
    const plan = buildAgentStartupPlan({
      agent: 'pi',
      prompt: 'fix it',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("pi 'fix it'")
    expect(plan?.startupCommandDelivery).toBeUndefined()
  })

  it('keeps plain empty startup on the fast delivery path', () => {
    const plan = buildAgentStartupPlan({
      agent: 'pi',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan).toEqual({
      agent: 'pi',
      launchCommand: 'pi',
      expectedProcess: 'pi',
      followupPrompt: null,
      launchConfig: { agentCommand: 'pi', agentArgs: '', agentEnv: {} }
    })
  })

  it('launches Claude without Girra settings injection', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude 'fix it'")
    expect(plan?.launchCommand).not.toContain('--settings')
  })

  it('uses the Linux Girra CLI command for Claude Agent Teams launches', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('orca-ide claude-teams')
  })

  it('uses the plain orca shim for Claude Agent Teams on Linux SSH remotes', () => {
    // Why: the SSH relay deploys the CLI shim as `orca` (not the local-only
    // `orca-ide` GNOME-screen-reader workaround), so a remote launch must not
    // emit `orca-ide claude-teams` — that name is not on the remote PATH and
    // `claude-teams` is rejected by the relay's CLI switch (issue #6500).
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      isRemote: true,
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('orca claude-teams')
  })

  it('keeps the Windows orca.cmd shim for Claude Agent Teams on SSH remotes', () => {
    // Why: the Windows remote shim is also `orca.cmd`, matching the local
    // win32 override, so remoteness must not alter the Windows command.
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: '',
      cmdOverrides: {},
      platform: 'win32',
      isRemote: true,
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('orca.cmd claude-teams')
  })

  it('keeps the Linux orca-ide wrapper for local (non-remote) Claude Agent Teams', () => {
    // Why: the `orca-ide` rename is still required for a local Linux desktop
    // install (avoids shadowing the GNOME Orca screen reader), so an explicit
    // isRemote:false must preserve it.
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      isRemote: false,
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('orca-ide claude-teams')
  })

  it('launches stdin agents through their launch command and expected process', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: 'fix it',
      cmdOverrides: {},
      platform: 'darwin'
    })

    expect(plan).toEqual({
      agent: 'claude-agent-teams',
      launchCommand: 'orca claude-teams',
      expectedProcess: 'claude',
      followupPrompt: 'fix it',
      launchConfig: { agentCommand: 'orca claude-teams', agentArgs: '', agentEnv: {} }
    })
  })

  it('leaves Claude command overrides untouched', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: { claude: 'claude --dangerously-skip-permissions' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude --dangerously-skip-permissions 'fix it'")
  })

  it('leaves OpenCode command overrides untouched', () => {
    const plan = buildAgentStartupPlan({
      agent: 'opencode',
      prompt: 'fix it',
      cmdOverrides: { opencode: 'opencode --profile work' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("opencode --profile work --prompt 'fix it'")
  })

  it('builds Windows resume plans that PowerShell can invoke', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: {},
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("claude '--resume' 's1'")
  })

  it('quotes Windows resume argv for cmd.exe when shell is cmd', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: '019fc272-80fa-7a91-80a2-9c461ef1a9da' },
      cmdOverrides: {},
      agentArgs: '--permission-mode bypassPermissions',
      platform: 'win32',
      shell: 'cmd'
    })

    // Why: cmd.exe treats single quotes as literal characters. Resume must use
    // double quotes (or unquoted tokens) so the CLI receives clean argv.
    expect(plan?.launchCommand).toBe(
      'claude "--permission-mode" "bypassPermissions" "--resume" "019fc272-80fa-7a91-80a2-9c461ef1a9da"'
    )
  })

  it('keeps cmd-quoted agentCommand aligned with cmd resume suffix', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: '019fc272-80fa-7a91-80a2-9c461ef1a9da' },
      cmdOverrides: {},
      agentCommand: 'claude "--permission-mode" "bypassPermissions"',
      platform: 'win32',
      shell: 'cmd'
    })

    // Regression: agentCommand from a prior cmd launch + PowerShell-default resume
    // suffix produced mixed quoting and broke reboot restore on cmd.exe tabs.
    expect(plan?.launchCommand).toBe(
      'claude "--permission-mode" "bypassPermissions" "--resume" "019fc272-80fa-7a91-80a2-9c461ef1a9da"'
    )
  })

  it('honors command overrides when building POSIX resume plans', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: { claude: 'claude --profile work' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude --profile work '--resume' 's1'")
  })

  it('uses a captured launch command when building resume plans after overrides change', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: { claude: 'claude --profile changed' },
      agentCommand: 'claude --profile captured',
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude --profile captured '--resume' 's1'")
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'claude --profile captured',
      agentArgs: '',
      agentEnv: {}
    })
  })

  it('appends shell-quoted CLI arguments before prompt delivery flags', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: '--model sonnet --add-dir "path with spaces"',
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe(
      "claude '--model' 'sonnet' '--add-dir' 'path with spaces' 'fix it'"
    )
  })

  it('uses PowerShell quoting for CLI arguments on Windows', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: '--model sonnet --name "Bob\'s"',
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("claude '--model' 'sonnet' '--name' 'Bob''s' 'fix it'")
  })

  it('carries agent launch environment defaults into startup plans', () => {
    const plan = buildAgentStartupPlan({
      agent: 'opencode',
      prompt: '',
      cmdOverrides: {},
      agentEnv: { OPENCODE_CONFIG: 'work.json' },
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('opencode')
    expect(plan?.env).toEqual({ OPENCODE_CONFIG: 'work.json' })
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'opencode',
      agentArgs: '',
      agentEnv: { OPENCODE_CONFIG: 'work.json' }
    })
  })

  it('captures empty args and env as explicit launch config values', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      agentArgs: '',
      agentEnv: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchConfig).toEqual({ agentCommand: 'claude', agentArgs: '', agentEnv: {} })
  })

  it('does not append the unsupported OpenCode TUI skip-permissions arg', () => {
    const agentDefaultArgs = normalizeTuiAgentArgsRecord({
      opencode: '--dangerously-skip-permissions'
    })
    const plan = buildAgentStartupPlan({
      agent: 'opencode',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: resolveTuiAgentLaunchArgs('opencode', agentDefaultArgs),
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("opencode --prompt 'fix it'")
  })

  it('keeps opencode on the cursor-gated paste draft route', () => {
    expect(TUI_AGENT_CONFIG.opencode.draftPasteReadySignal).toBe(
      'render-cursor-after-bracketed-paste'
    )
    expect(TUI_AGENT_CONFIG.opencode.draftPromptFlag).toBeUndefined()
    expect(TUI_AGENT_CONFIG.opencode.draftPromptEnvVar).toBeUndefined()
    // Why: no native draft launch plan means the agent falls through to the
    // cursor-gated paste-after-ready route, where the new signal applies.
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'opencode',
        draft: 'x',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })

  it('appends CLI arguments after a launch subcommand', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: '--add-dir "*"',
      platform: 'darwin'
    })

    expect(plan?.launchCommand).toBe("orca claude-teams '--add-dir' '*'")
  })

  it('clears draft environment variables with the target shell syntax', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'pi',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'win32'
      })?.launchCommand
    ).toBe('pi; Remove-Item Env:ORCA_PI_PREFILL -ErrorAction SilentlyContinue')

    expect(
      buildAgentDraftLaunchPlan({
        agent: 'pi',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'win32',
        shell: 'cmd'
      })?.launchCommand
    ).toBe('pi & set "ORCA_PI_PREFILL="')
  })

  it('returns null for oversized Windows flag drafts so callers paste after ready', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'x'.repeat(25_000),
        cmdOverrides: {},
        platform: 'win32'
      })
    ).toBeNull()
  })

  it('returns null for oversized Windows env-var drafts so callers paste after ready', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'pi',
        draft: 'x'.repeat(25_000),
        cmdOverrides: {},
        platform: 'win32'
      })
    ).toBeNull()
  })

  it('launches stdin agents with default args and stdin-after-start prompt delivery', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude-agent-teams',
      prompt: 'fix the tests',
      cmdOverrides: {},
      agentArgs: resolveTuiAgentLaunchArgs('claude-agent-teams', null),
      platform: 'darwin'
    })
    expect(plan).toEqual({
      agent: 'claude-agent-teams',
      launchCommand: "orca claude-teams '--dangerously-skip-permissions'",
      expectedProcess: 'claude',
      followupPrompt: 'fix the tests',
      launchConfig: {
        agentCommand: "orca claude-teams '--dangerously-skip-permissions'",
        agentArgs: '--dangerously-skip-permissions',
        agentEnv: {}
      }
    })
  })

  it('excludes transient draft prompt env from launch config', () => {
    const plan = buildAgentDraftLaunchPlan({
      agent: 'pi',
      draft: 'prefill text',
      cmdOverrides: {},
      agentEnv: { ORCA_AGENT_MODE: 'managed' },
      platform: 'linux'
    })

    expect(plan?.env).toEqual({ ORCA_AGENT_MODE: 'managed', ORCA_PI_PREFILL: 'prefill text' })
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'pi',
      agentArgs: '',
      agentEnv: { ORCA_AGENT_MODE: 'managed' }
    })
  })

  it('appends Claude Agent Teams default skip-permissions before stdin prompt delivery', () => {
    expect(resolveTuiAgentLaunchArgs('claude-agent-teams', null)).toBe(
      '--dangerously-skip-permissions'
    )
  })
})
