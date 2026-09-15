import { describe, expect, it } from 'vitest'

import {
  buildAiVaultResumeCommand,
  buildAiVaultResumeShellCommand
} from './ai-vault-resume-command'

describe('buildAiVaultResumeCommand', () => {
  it('resumes Claude with --resume', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: 'session-1',
        cwd: '/repo/app',
        platform: 'darwin'
      })
    ).toBe("cd '/repo/app' && claude --resume 'session-1'")
  })

  it('resumes OpenCode and Pi with --session', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'opencode',
        sessionId: 'ses_1',
        cwd: '/repo/app',
        platform: 'linux'
      })
    ).toBe("cd '/repo/app' && opencode --session 'ses_1'")
    expect(
      buildAiVaultResumeCommand({ agent: 'pi', sessionId: 'pi-1', cwd: null, platform: 'linux' })
    ).toBe("pi --session 'pi-1'")
  })

  it('builds a self-contained cmd wrapper when no live shell is known', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: 'session-1',
        cwd: 'C:\\Users\\Ada Lovelace\\repo',
        platform: 'win32'
      })
    ).toBe(
      'cmd /d /s /c "cd /d ""C:\\Users\\Ada Lovelace\\repo"" && claude --resume ""session-1"""'
    )
  })

  it('builds a direct queued command for a live cmd shell', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: 'A&B session one',
        cwd: 'C:\\Users\\Ada Lovelace\\A&B repo',
        platform: 'win32',
        shell: 'cmd'
      })
    ).toBe('cd /d "C:\\Users\\Ada Lovelace\\A&B repo" && claude --resume "A&B session one"')
  })

  it('quotes queued resume commands for the provided Windows shell', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: '019f27cd-4268-7000-96e7-62f42a55c144',
        cwd: 'C:\\Users\\Ada Lovelace\\repo',
        platform: 'win32',
        shell: 'powershell'
      })
    ).toBe(
      "Set-Location -LiteralPath 'C:\\Users\\Ada Lovelace\\repo'; claude --resume '019f27cd-4268-7000-96e7-62f42a55c144'"
    )
  })

  it('applies a command override', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: 'session-1',
        cwd: null,
        platform: 'darwin',
        commandOverride: '  /opt/bin/claude  '
      })
    ).toBe("/opt/bin/claude --resume 'session-1'")
  })
})

describe('buildAiVaultResumeShellCommand', () => {
  it('uses a git-bash cd prefix under a POSIX shell on Windows', () => {
    expect(
      buildAiVaultResumeShellCommand({
        resumeCommand: "claude --resume 'sid'",
        cwd: '/c/repo',
        platform: 'win32',
        shell: 'posix'
      })
    ).toBe("cd '/c/repo' && claude --resume 'sid'")
  })

  // Why: the shell decides the grammar, not the host.
  it('uses PowerShell grammar for a PowerShell shell on a non-Windows host', () => {
    expect(
      buildAiVaultResumeShellCommand({
        resumeCommand: "claude --resume 'sid'",
        cwd: '/repo',
        platform: 'linux',
        shell: 'powershell'
      })
    ).toBe("Set-Location -LiteralPath '/repo'; claude --resume 'sid'")
  })
})
