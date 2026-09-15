import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import { applyClaudeEnvPatch } from '../claude-accounts/environment'
import { readShellStartupEnvVar } from '../pty/shell-startup-env'

export type CommitMessageAgentEnvironmentResolvers = {
  prepareForClaudeLaunch?: (
    target?: CommitMessageAgentRuntimeTarget
  ) => Promise<ClaudeRuntimeAuthPreparation>
}

export type CommitMessageAgentRuntimeTarget = {
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
}

function cloneProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }
  return env
}

function readInheritedOrShellEnvVar(name: string, sourceName?: string): string | undefined {
  return (
    (sourceName ? process.env[sourceName] : undefined) ??
    process.env[name] ??
    readShellStartupEnvVar(name, process.env.HOME, process.env.SHELL)
  )
}

function prepareShellConfigDirEnv(agentId: string): { ok: true; env?: NodeJS.ProcessEnv } | null {
  const configVar =
    agentId === 'opencode' ? 'OPENCODE_CONFIG_DIR' : agentId === 'pi' ? 'PI_CODING_AGENT_DIR' : null
  if (!configVar) {
    return null
  }
  const sourceVar =
    agentId === 'opencode' ? 'ORCA_OPENCODE_SOURCE_CONFIG_DIR' : 'ORCA_PI_SOURCE_AGENT_DIR'

  const value = readInheritedOrShellEnvVar(configVar, sourceVar)
  if (!value) {
    return { ok: true }
  }

  // Why: GUI-launched Orca may not inherit shell startup exports, but these
  // vars point the headless CLI at the user's auth/config root. Nested Orca
  // launches inherit PTY overlays, so prefer ORCA_*_SOURCE_* when present.
  return { ok: true, env: { ...cloneProcessEnv(), [configVar]: value } }
}

export async function prepareLocalCommitMessageAgentEnv(
  agentId: string,
  resolvers: CommitMessageAgentEnvironmentResolvers | undefined,
  target?: CommitMessageAgentRuntimeTarget
): Promise<{ ok: true; env?: NodeJS.ProcessEnv } | { ok: false; error: string }> {
  // Why: a non-null result short-circuits the resolvers below, so any agent added
  // to prepareShellConfigDirEnv must not also need a Claude-style resolver.
  const shellConfigEnv = target?.runtime === 'wsl' ? null : prepareShellConfigDirEnv(agentId)
  if (shellConfigEnv) {
    return shellConfigEnv
  }
  if (!resolvers) {
    return { ok: true }
  }

  try {
    if (agentId === 'claude' && resolvers.prepareForClaudeLaunch) {
      const preparation = await resolvers.prepareForClaudeLaunch(target)
      const env = applyClaudeEnvPatch(cloneProcessEnv(), preparation.envPatch, {
        stripAuthEnv: preparation.stripAuthEnv
      })
      return { ok: true, env }
    }
  } catch (error) {
    console.error('[commit-message] Failed to prepare agent environment:', error)
    return {
      ok: false,
      error: 'Failed to prepare the selected agent account for commit message generation.'
    }
  }

  return { ok: true }
}
