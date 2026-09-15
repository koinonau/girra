import type { AiVaultSession } from '../../../shared/ai-vault-types'
import {
  buildAiVaultResumeCommand,
  buildAiVaultResumeShellCommand
} from '../../../shared/ai-vault-resume-command'
import {
  isResumableTuiAgent,
  type AgentProviderSessionMetadata,
  type SleepingAgentLaunchConfig
} from '../../../shared/agent-session-resume'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../shared/tui-agent-launch-defaults'
import { parseWslUncPath } from '../../../shared/wsl-paths'
import type { AgentStartupShell } from '../../../shared/tui-agent-startup-shell'
import type { AppState } from '@/store/types'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import { CLIENT_PLATFORM } from '@/lib/new-workspace'
import { buildAgentResumeStartupPlan } from '@/lib/tui-agent-startup'
import { getExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import { LOCAL_EXECUTION_HOST_ID, parseExecutionHostId } from '../../../shared/execution-host'
import {
  getAiVaultResumeWorkspacePath,
  resolveAiVaultResumeStartupShell
} from '@/lib/ai-vault-resume-shell'

type AiVaultResumeCommandSession = Pick<AiVaultSession, 'agent' | 'sessionId' | 'cwd'> &
  Partial<
    Pick<AiVaultSession, 'executionHostId' | 'executionHostPlatform' | 'resumeCommand' | 'filePath'>
  >

export type AiVaultResumeStartup = {
  command: string
  cwd?: string
  env?: Record<string, string>
  launchConfig?: SleepingAgentLaunchConfig
  providerSession?: AgentProviderSessionMetadata
}

type AiVaultResumeWorktreeArgs = {
  state: Pick<
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
  worktreeId?: string | null
  session: AiVaultResumeCommandSession
  commandOverride?: string | null
}

export function buildAiVaultResumeCopyCommandForWorktree(args: AiVaultResumeWorktreeArgs): string {
  return buildAiVaultResumeForWorktree(args, true).command
}

export function buildAiVaultResumeStartupForWorktree(
  args: AiVaultResumeWorktreeArgs
): AiVaultResumeStartup {
  return buildAiVaultResumeForWorktree(args, false)
}

function buildAiVaultResumeForWorktree(
  args: AiVaultResumeWorktreeArgs,
  embedCwd: boolean
): AiVaultResumeStartup {
  const providerSession = getAiVaultAgentProviderSession(args.session)
  if (
    args.session.executionHostId &&
    args.session.executionHostId !== LOCAL_EXECUTION_HOST_ID &&
    args.session.resumeCommand &&
    !args.commandOverride?.trim()
  ) {
    return {
      command: args.session.resumeCommand,
      ...(providerSession ? { providerSession } : {})
    }
  }
  const platform =
    args.session.executionHostId &&
    args.session.executionHostId !== LOCAL_EXECUTION_HOST_ID &&
    args.session.executionHostPlatform
      ? args.session.executionHostPlatform
      : getAiVaultResumePlatform(args.state, args.worktreeId)
  const isLocalSession =
    !args.session.executionHostId || args.session.executionHostId === LOCAL_EXECUTION_HOST_ID
  // Why: local shell settings do not describe a remote Windows host, whose
  // queued resume command uses the remote default PowerShell syntax.
  const liveShell: AgentStartupShell | undefined =
    platform === 'win32'
      ? isLocalSession
        ? resolveAiVaultResumeShell(args)
        : 'powershell'
      : undefined
  const cwd = embedCwd ? args.session.cwd : null
  const startupCwd = !embedCwd && args.session.cwd ? { cwd: args.session.cwd } : {}
  if (providerSession && isResumableTuiAgent(args.session.agent)) {
    const startupPlan = buildAgentResumeStartupPlan({
      agent: args.session.agent,
      providerSession,
      cmdOverrides: {
        ...args.state.settings?.agentCmdOverrides,
        ...(args.commandOverride?.trim() ? { [args.session.agent]: args.commandOverride } : {})
      },
      platform,
      shell: liveShell,
      agentArgs: resolveTuiAgentLaunchArgs(
        args.session.agent,
        args.state.settings?.agentDefaultArgs
      ),
      agentEnv: resolveTuiAgentLaunchEnv(args.session.agent, args.state.settings?.agentDefaultEnv)
    })
    if (startupPlan) {
      return {
        command: buildAiVaultResumeShellCommand({
          resumeCommand: startupPlan.launchCommand,
          cwd,
          platform,
          shell: liveShell
        }),
        ...(startupPlan.env ? { env: startupPlan.env } : {}),
        ...startupCwd,
        launchConfig: startupPlan.launchConfig,
        providerSession
      }
    }
  }

  return {
    command: buildAiVaultResumeCommand({
      agent: args.session.agent,
      sessionId: args.session.sessionId,
      cwd,
      platform,
      commandOverride: args.commandOverride,
      // Why: this fallback must quote for the live Windows shell like the
      // startup-plan branch above.
      shell: liveShell
    }),
    ...startupCwd
  }
}

function resolveAiVaultResumeShell(args: AiVaultResumeWorktreeArgs): AgentStartupShell {
  const platform =
    args.session.executionHostId &&
    args.session.executionHostId !== LOCAL_EXECUTION_HOST_ID &&
    args.session.executionHostPlatform
      ? args.session.executionHostPlatform
      : getAiVaultResumePlatform(args.state, args.worktreeId)
  const isLocalSession =
    !args.session.executionHostId || args.session.executionHostId === LOCAL_EXECUTION_HOST_ID
  return resolveAiVaultResumeStartupShell({
    state: args.state,
    worktreeId: args.worktreeId,
    platform,
    isLocalSession
  })
}

export function getAiVaultAgentProviderSession(
  session: Pick<AiVaultSession, 'agent' | 'sessionId'> & { filePath?: string }
): AgentProviderSessionMetadata | null {
  if (!isResumableTuiAgent(session.agent)) {
    return null
  }
  if (session.agent === 'pi') {
    return session.filePath
      ? { key: 'session_id', id: session.sessionId, transcriptPath: session.filePath }
      : null
  }
  return { key: 'session_id', id: session.sessionId }
}

export function getAiVaultResumePlatform(
  state: Pick<
    AppState,
    | 'activeRepoId'
    | 'activeWorktreeId'
    | 'folderWorkspaces'
    | 'projectGroups'
    | 'projects'
    | 'repos'
    | 'settings'
    | 'worktreesByRepo'
  >,
  worktreeId?: string | null
): NodeJS.Platform {
  const targetWorktreeId = worktreeId ?? state.activeWorktreeId
  const executionHost = parseExecutionHostId(getExecutionHostIdForWorktree(state, targetWorktreeId))
  if (executionHost?.kind === 'ssh' || executionHost?.kind === 'runtime') {
    return 'linux'
  }

  const projectRuntime = getLocalProjectExecutionRuntimeContext(state, worktreeId, CLIENT_PLATFORM)
  if (projectRuntime?.status === 'repair-required') {
    return projectRuntime.repair.preferredRuntime.kind === 'wsl' ? 'linux' : CLIENT_PLATFORM
  }
  if (projectRuntime?.status === 'resolved' && projectRuntime.runtime.kind === 'wsl') {
    return 'linux'
  }

  const workspacePath = getAiVaultResumeWorkspacePath(state, targetWorktreeId)
  return workspacePath && parseWslUncPath(workspacePath) ? 'linux' : CLIENT_PLATFORM
}
