import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import {
  buildAiVaultResumeCopyCommandForWorktree,
  buildAiVaultResumeStartupForWorktree,
  getAiVaultResumePlatform
} from './ai-vault-resume-command'

vi.mock('@/lib/new-workspace', () => ({
  CLIENT_PLATFORM: 'win32'
}))

type RuntimePreference = { kind: 'windows-host' } | { kind: 'wsl'; distro: string }

type AiVaultResumeCommandState = Pick<
  AppState,
  | 'activeRepoId'
  | 'activeWorktreeId'
  | 'folderWorkspaces'
  | 'projectGroups'
  | 'projects'
  | 'repos'
  | 'settings'
  | 'worktreesByRepo'
>

function makeState(args: {
  worktreePath: string
  localWindowsRuntimePreference?: RuntimePreference
  terminalWindowsShell?: string
}): AiVaultResumeCommandState {
  return {
    activeRepoId: 'repo-1',
    activeWorktreeId: 'repo-1::worktree-1',
    folderWorkspaces: [],
    projectGroups: [],
    repos: [{ id: 'repo-1', path: 'C:\\Users\\alice\\repo' }],
    projects: [
      {
        id: 'repo-1',
        sourceRepoIds: ['repo-1'],
        ...(args.localWindowsRuntimePreference
          ? { localWindowsRuntimePreference: args.localWindowsRuntimePreference }
          : {})
      }
    ],
    settings: {
      localWindowsRuntimeDefault: { kind: 'windows-host' },
      ...(args.terminalWindowsShell ? { terminalWindowsShell: args.terminalWindowsShell } : {}),
      agentDefaultArgs: { claude: '' },
      agentDefaultEnv: { claude: {} }
    },
    worktreesByRepo: {
      'repo-1': [
        {
          id: 'repo-1::worktree-1',
          repoId: 'repo-1',
          path: args.worktreePath
        }
      ]
    }
  } as unknown as AiVaultResumeCommandState
}

function buildQueuedAiVaultResumeCommand(
  args: Parameters<typeof buildAiVaultResumeStartupForWorktree>[0]
): string {
  return buildAiVaultResumeStartupForWorktree(args).command
}

describe('ai vault resume command runtime', () => {
  it('repro: queues a host-runtime resume without configured-WSL shell syntax', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      localWindowsRuntimePreference: { kind: 'windows-host' },
      terminalWindowsShell: 'wsl.exe'
    })

    expect(
      buildAiVaultResumeStartupForWorktree({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toMatchObject({
      command: "claude '--resume' 'session one'",
      cwd: 'C:\\Users\\alice\\repo'
    })
  })

  it('queues a PowerShell-valid command for the default Windows shell', () => {
    // Why: the queued command is typed into the live tab shell (default
    // PowerShell), which mis-parses the cmd `""`-doubled wrapper (#6152).
    const state = makeState({ worktreePath: 'C:\\Users\\alice\\repo' })

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('queues direct cmd syntax when the configured Windows shell is cmd.exe', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      terminalWindowsShell: 'cmd.exe'
    })

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe('claude "--resume" "session one"')
  })

  it('queues a POSIX command for the Git Bash Windows shell', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      terminalWindowsShell: 'git-bash'
    })

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('follows the live Windows shell for non-resumable agents in the fallback path', () => {
    // Why: sessions without a TUI startup plan (Pi with no transcript path) queue through the
    // shared-builder fallback, which must quote for the live shell too (#6152).
    const state = makeState({ worktreePath: 'C:\\Users\\alice\\repo' })

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'pi',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe("pi --session 'session one'")
  })

  it('copies syntax that matches the configured cmd shell', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      terminalWindowsShell: 'cmd.exe'
    })

    expect(
      buildAiVaultResumeCopyCommandForWorktree({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe('cd /d "C:\\Users\\alice\\repo" && claude "--resume" "session one"')
  })

  it('copies syntax that matches the configured PowerShell shell', () => {
    const state = makeState({ worktreePath: 'C:\\Users\\alice\\repo' })

    expect(
      buildAiVaultResumeCopyCommandForWorktree({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:\\Users\\alice\\repo'
        }
      })
    ).toBe("Set-Location -LiteralPath 'C:\\Users\\alice\\repo'; claude '--resume' 'session one'")
  })

  it('uses configured agent defaults for resumable session history entries', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      localWindowsRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
    })
    state.settings = {
      ...state.settings,
      agentDefaultArgs: { claude: '--dangerously-skip-permissions --effort max' },
      agentDefaultEnv: { claude: { ANTHROPIC_BASE_URL: 'https://claude.example.test' } }
    } as never

    expect(
      buildAiVaultResumeStartupForWorktree({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session-1',
          cwd: '/home/alice/repo'
        }
      })
    ).toEqual({
      command: "claude '--dangerously-skip-permissions' '--effort' 'max' '--resume' 'session-1'",
      cwd: '/home/alice/repo',
      env: { ANTHROPIC_BASE_URL: 'https://claude.example.test' },
      launchConfig: {
        agentCommand: "claude '--dangerously-skip-permissions' '--effort' 'max'",
        agentArgs: '--dangerously-skip-permissions --effort max',
        agentEnv: { ANTHROPIC_BASE_URL: 'https://claude.example.test' }
      },
      providerSession: { key: 'session_id', id: 'session-1' }
    })
  })

  it('uses POSIX command wrapping for Windows-path projects forced to WSL', () => {
    const state = makeState({
      worktreePath: 'C:\\Users\\alice\\repo',
      localWindowsRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
    })

    expect(getAiVaultResumePlatform(state, 'repo-1::worktree-1')).toBe('linux')
    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/repo'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('uses POSIX command wrapping for SSH-owned worktrees on Windows clients', () => {
    const state = makeState({ worktreePath: '/home/alice/repo' })
    state.repos = [{ id: 'repo-1', path: '/home/alice/repo', connectionId: 'ssh-1' }] as never

    expect(getAiVaultResumePlatform(state, 'repo-1::worktree-1')).toBe('linux')
    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/repo'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('uses POSIX command wrapping for folder workspaces with their own SSH target', () => {
    const state = makeState({ worktreePath: 'C:\\Users\\alice\\repo' })
    state.activeWorktreeId = 'folder:folder-1'
    state.folderWorkspaces = [
      {
        id: 'folder-1',
        projectGroupId: 'group-1',
        name: 'Platform',
        folderPath: '/home/alice/platform',
        connectionId: 'folder-ssh'
      }
    ] as never
    state.projectGroups = [{ id: 'group-1', connectionId: null, executionHostId: null }] as never

    expect(getAiVaultResumePlatform(state, 'folder:folder-1')).toBe('linux')
    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'folder:folder-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/platform'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('uses POSIX command wrapping for WSL UNC folder workspaces on Windows clients', () => {
    const state = makeState({ worktreePath: 'C:\\Users\\alice\\repo' })
    state.activeWorktreeId = 'folder:folder-1'
    state.folderWorkspaces = [
      {
        id: 'folder-1',
        projectGroupId: 'group-1',
        name: 'Platform',
        folderPath: '\\\\wsl.localhost\\Ubuntu\\home\\alice\\platform'
      }
    ] as never
    state.projectGroups = [{ id: 'group-1', connectionId: null, executionHostId: 'local' }] as never

    expect(getAiVaultResumePlatform(state, 'folder:folder-1')).toBe('linux')
    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'folder:folder-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/platform'
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })

  it('keeps WSL UNC worktrees on POSIX command wrapping without an explicit override', () => {
    const state = makeState({
      worktreePath: '\\\\wsl.localhost\\Ubuntu\\home\\alice\\repo'
    })

    expect(getAiVaultResumePlatform(state, 'repo-1::worktree-1')).toBe('linux')
  })

  it('rebuilds the command when a non-blank override is supplied for a remote session', () => {
    const state = makeState({ worktreePath: '/home/alice/repo' })
    state.repos = [{ id: 'repo-1', path: '/home/alice/repo', connectionId: 'ssh-1' }] as never

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        commandOverride: 'my-claude',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/repo',
          executionHostId: 'ssh:dev-box',
          resumeCommand: "claude --resume 'session one'"
        }
      })
    ).toBe("my-claude '--resume' 'session one'")
  })

  it('rebuilds overridden remote commands with the recorded remote host platform', () => {
    const state = makeState({
      worktreePath: '/home/alice/repo',
      terminalWindowsShell: 'cmd.exe'
    })
    state.repos = [{ id: 'repo-1', path: '/home/alice/repo', connectionId: 'ssh-1' }] as never

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        commandOverride: 'my-claude',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: 'C:/Users/alice/repo',
          executionHostId: 'ssh:win-box',
          executionHostPlatform: 'win32',
          resumeCommand:
            'cmd /d /s /c "cd /d ""C:/Users/alice/repo"" && claude --resume ""session one"""'
        }
      })
    ).toBe("my-claude '--resume' 'session one'")
  })

  it('keeps the scanner resume command for remote sessions', () => {
    const state = makeState({ worktreePath: '/home/alice/repo' })
    state.repos = [{ id: 'repo-1', path: '/home/alice/repo', connectionId: 'ssh-1' }] as never

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'opencode',
          sessionId: 'ses_940237d9',
          cwd: '/home/alice/repo',
          executionHostId: 'ssh:dev-box',
          resumeCommand: "opencode --session 'ses_940237d9'"
        }
      })
    ).toBe("opencode --session 'ses_940237d9'")
  })

  it('ignores a stored resume command for local-host sessions', () => {
    const state = makeState({ worktreePath: '/home/alice/repo' })
    state.repos = [{ id: 'repo-1', path: '/home/alice/repo', connectionId: 'ssh-1' }] as never

    expect(
      buildQueuedAiVaultResumeCommand({
        state,
        worktreeId: 'repo-1::worktree-1',
        session: {
          agent: 'claude',
          sessionId: 'session one',
          cwd: '/home/alice/repo',
          executionHostId: 'local',
          resumeCommand: "cd '/somewhere' && claude --resume 'session one'"
        }
      })
    ).toBe("claude '--resume' 'session one'")
  })
})
