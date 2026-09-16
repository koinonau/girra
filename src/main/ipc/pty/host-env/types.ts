import type { TuiAgent } from '../../../../shared/tui-agent'
import type { NetworkProxySettings } from '../../../../shared/network-proxy'
import type { ClaudeRuntimeAuthPreparation } from '../../../claude-accounts/runtime-auth-service'
import type { ClaudeAccountSelectionTarget } from '../../../claude-accounts/runtime-selection'

export type BuildPtyHostEnvOptions = {
  isPackaged: boolean
  resourcesPath?: string
  userDataPath: string
  /** Launch command the renderer chose (e.g. 'pi', 'claude'); an explicit Pi launch may create
   *  Pi's default home. Undefined for bare shells. */
  launchCommand?: string
  /** Trusted agent identity for wrapped commands that cannot be recognized from text. */
  launchAgent?: TuiAgent
  isWsl?: boolean
  /** Distro for WSL spawns (null = Windows default distro); drives the WSL hook relay + endpoint repoint. Only read when isWsl. */
  wslDistro?: string | null
  agentStatusHooksEnabled: boolean
  networkProxySettings?: NetworkProxySettings
  /** Headless paired runtimes hand browser launches to the client-hosted Girra browser. */
  routeBrowserOpensToClient?: boolean
  /** Keep indexed Git config off the sparse daemon wire; the daemon appends guard entries after merging its inherited env. */
  deferGitConfigGuardToDaemon?: boolean
}

export type PrepareClaudeAuth = (
  target?: ClaudeAccountSelectionTarget
) => Promise<ClaudeRuntimeAuthPreparation>
