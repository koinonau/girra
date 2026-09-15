import type { TuiAgent } from '../../../../shared/tui-agent'
import type { SleepingAgentLaunchConfig } from '../../../../shared/agent-session-resume'
import type { ProjectExecutionRuntimeResolution } from '../../../../shared/project-execution-runtime'
import type { StartupCommandDelivery } from '../../../../shared/startup-command-delivery'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { TerminalStartupCwdMissingDirFallback } from '../../../../shared/terminal-startup-cwd'
import type { OrcaRuntimeService } from '../../../runtime/orca-runtime'
import type { Store } from '../../../persistence'
import type { PtySpawnResult } from '../../../providers/types'
import type { PrepareClaudeAuth } from '../host-env/types'
import type { StablePaneOwner } from '../pane/stable-owner'

export type PtySpawnIpcArgs = {
  cols: number
  rows: number
  cwd?: string
  // Why: fresh local spawns opt into recovering a saved cwd whose dir was deleted (#7239); reattach/remote need exact cwd, so the flag alone isn't sufficient.
  cwdFallback?: 'worktree'
  env?: Record<string, string>
  envToDelete?: string[]
  command?: string
  commandDelivery?: 'renderer' | 'provider'
  launchConfig?: SleepingAgentLaunchConfig
  launchToken?: unknown
  launchAgent?: TuiAgent
  startupCommandDelivery?: StartupCommandDelivery
  connectionId?: string | null
  worktreeId?: string
  sessionId?: string
  shellOverride?: string
  projectRuntime?: ProjectExecutionRuntimeResolution
  terminalColorQueryReplies?: {
    foreground?: unknown
    background?: unknown
  }
  // Why: hidden-at-spawn declaration (terminal-query-authority.md §races) — main marks hidden before byte zero so the gate owns spawn-time queries.
  initiallyHidden?: boolean
  // Why: closes the SIGKILL race (INVESTIGATION.md) by letting main sync-flush the binding before pty:spawn returns; only the Ctrl+T daemon-host path threads these.
  tabId?: string
  leafId?: string
  // Why: renderer-threaded launch identity; loosely typed because each reader validates it with agentKindSchema.
  telemetry?: {
    agent_kind?: unknown
    launch_source?: unknown
    request_kind?: unknown
  }
}

export type AdoptStablePaneArgs = {
  cols: number
  rows: number
  cwd?: string
  connectionId?: string | null
  worktreeId: string
  preAllocatedHandle?: string
  tabId: string
  leafId: string
  ownsPaneSpawnReservation?: true
}

export type AdoptStablePaneResult = {
  result: PtySpawnResult
  owner: StablePaneOwner
  materialized?: true
}

export type PtySpawnIpcDeps = {
  runtime?: OrcaRuntimeService
  store?: Store
  getSettings?: () => GlobalSettings
  prepareClaudeAuth?: PrepareClaudeAuth
  getLocalPtyStartupPromise: (connectionId?: string | null) => Promise<void> | undefined
  adoptStablePane: (args: AdoptStablePaneArgs) => Promise<AdoptStablePaneResult | null>
  assertFolderWorkspacePtyPathUsable: (worktreeId: string | undefined) => Promise<void> | void
  resolvePtySpawnStartupCwd: (
    worktreeId: string | undefined,
    cwd: string | undefined,
    missingDirFallback?: TerminalStartupCwdMissingDirFallback
  ) => string | undefined
  localStartupCwdDirectoryExists: (path: string) => boolean
  transitionSpawnHiddenRendererPtyDeliveryState: (id: string, hidden: boolean) => void
  trustedTerminalHandleEnv: Set<string>
  sendPtySpawnedToRenderer: (id: string) => void
  syncPtyBackgroundedDelivery: (id: string, caller: string) => void
}
