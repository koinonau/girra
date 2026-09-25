import { applyLegacyOrcaEnvAliases, legacyOrcaEnvName } from '../shared/legacy-orca-env-aliases'

export function pickRemoteCliEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of [
    'GIRRA_TERMINAL_HANDLE',
    'GIRRA_WORKTREE_ID',
    'GIRRA_PANE_KEY',
    'GIRRA_AGENT_LAUNCH_TOKEN',
    'GIRRA_WORKSPACE_ID',
    'GIRRA_USER_DATA_PATH',
    'PATH',
    'Path'
  ]) {
    // Why the legacy read: an older client fills this env over the wire under the
    // ORCA_* names, and this process never saw them at its own entry.
    const legacy = legacyOrcaEnvName(key)
    const value = env[key] ?? (legacy === null ? undefined : env[legacy])
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  // Why the legacy write: the shim on this host may have been installed by a
  // client that predates the rename, and it reads only the ORCA_* names.
  applyLegacyOrcaEnvAliases(picked)
  return picked
}
