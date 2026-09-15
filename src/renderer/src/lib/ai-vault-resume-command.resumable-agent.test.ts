import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import {
  buildAiVaultResumeCopyCommandForWorktree,
  buildAiVaultResumeStartupForWorktree
} from './ai-vault-resume-command'

vi.mock('@/lib/new-workspace', () => ({
  CLIENT_PLATFORM: 'darwin'
}))

type ResumableAgentState = Pick<
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

function makeState(): ResumableAgentState {
  return {
    activeRepoId: 'repo-1',
    activeWorktreeId: 'repo-1::worktree-1',
    folderWorkspaces: [],
    projectGroups: [],
    repos: [{ id: 'repo-1', path: '/Users/ada/repo' }],
    projects: [{ id: 'repo-1', sourceRepoIds: ['repo-1'] }],
    settings: {
      agentDefaultArgs: { claude: '' },
      agentDefaultEnv: { claude: {} }
    },
    worktreesByRepo: {
      'repo-1': [{ id: 'repo-1::worktree-1', repoId: 'repo-1', path: '/Users/ada/repo' }]
    }
  } as unknown as ResumableAgentState
}

const OPENCODE_SESSION = {
  agent: 'opencode' as const,
  sessionId: 'ses_431324d72165',
  cwd: '/Users/ada/repo/packages/api'
}

describe('AI Vault resume for OpenCode', () => {
  it('keeps the cd prefix on the copied resume line', () => {
    expect(
      buildAiVaultResumeCopyCommandForWorktree({
        state: makeState(),
        worktreeId: 'repo-1::worktree-1',
        session: OPENCODE_SESSION
      })
    ).toBe("cd '/Users/ada/repo/packages/api' && opencode '--session' 'ses_431324d72165'")
  })

  it('takes the resumable-agent startup plan so the pane claims the provider session', () => {
    expect(
      buildAiVaultResumeStartupForWorktree({
        state: makeState(),
        worktreeId: 'repo-1::worktree-1',
        session: OPENCODE_SESSION
      })
    ).toMatchObject({
      command: "opencode '--session' 'ses_431324d72165'",
      cwd: '/Users/ada/repo/packages/api',
      launchConfig: { agentCommand: 'opencode' },
      providerSession: {
        key: 'session_id',
        id: 'ses_431324d72165'
      }
    })
  })
})
