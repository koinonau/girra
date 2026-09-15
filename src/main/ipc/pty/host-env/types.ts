import type { TuiAgent } from '../../../../shared/tui-agent'
import type { NetworkProxySettings } from '../../../../shared/network-proxy'
import type { ClaudeRuntimeAuthPreparation } from '../../../claude-accounts/runtime-auth-service'
import type { ClaudeAccountSelectionTarget } from '../../../claude-accounts/runtime-selection'

export type BuildPtyHostEnvOptions = {
  isPackaged: boolean
  resourcesPath?: string
  userDataPath: string
  /** Launch command the renderer chose (e.g. 'pi', 'omp', 'claude'); resolves the per-agent
   *  extension target for Pi/OMP. Undefined for bare shells → defaults to Pi. NEVER infer from
   *  disk presence (cross-agent shadowing when both dirs exist). */
  launchCommand?: string
  /** Trusted agent identity for wrapped commands that cannot be recognized from text. */
  launchAgent?: TuiAgent
  isWsl?: boolean
  /** Distro for WSL spawns (null = Windows default distro); drives the WSL hook relay + endpoint repoint. Only read when isWsl. */
  wslDistro?: string | null
  agentStatusHooksEnabled: boolean
  networkProxySettings?: NetworkProxySettings
  /** Headless paired runtimes hand browser launches to the client-hosted Orca browser. */
  routeBrowserOpensToClient?: boolean
  /** Keep indexed Git config off the sparse daemon wire; the daemon appends guard entries after merging its inherited env. */
  deferGitConfigGuardToDaemon?: boolean
}

export type PrepareClaudeAuth = (
  target?: ClaudeAccountSelectionTarget
) => Promise<ClaudeRuntimeAuthPreparation>
