import type { BrowserWindow } from 'electron'
import type { OrcaRuntimeService } from '../../../runtime/orca-runtime'
import type { Store } from '../../../persistence'
import type { IPtyProvider } from '../../../providers/types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { TerminalStartupCwdMissingDirFallback } from '../../../../shared/terminal-startup-cwd'
import type { PrepareClaudeAuth } from '../host-env/types'
import type { StablePaneOwner } from '../pane/stable-owner'
import type { AdoptStablePaneArgs, AdoptStablePaneResult } from '../ipc/spawn-types'
import type { finishPtyShutdown } from '../provider/liveness'

export type PtyRuntimeControllerDeps = {
  runtime?: OrcaRuntimeService
  store?: Store
  adoptStablePane: (args: AdoptStablePaneArgs) => Promise<AdoptStablePaneResult | null>
  getLocalPtyStartupPromise: (connectionId?: string | null) => Promise<void> | undefined
  getLocalPtyProviderStartupPromise: (connectionId?: string | null) => Promise<void> | undefined
  assertFolderWorkspacePtyPathUsable: (worktreeId: string | undefined) => Promise<void> | void
  resolvePtySpawnStartupCwd: (
    worktreeId: string | undefined,
    cwd: string | undefined,
    missingDirFallback?: TerminalStartupCwdMissingDirFallback
  ) => string | undefined
  requestSerializedBuffer: (
    ptyId: string,
    opts?: { scrollbackRows?: number }
  ) => Promise<{
    data: string
    cols: number
    rows: number
    seq?: number
    lastTitle?: string
    kittyKeyboardFlags?: number
  } | null>
  shutdownProviderAndDetectExit: (
    provider: IPtyProvider,
    id: string,
    opts: { immediate?: boolean; keepHistory?: boolean; deadlineMs?: number }
  ) => Promise<boolean>
  rememberSyntheticKillExit: (id: string) => void
  rememberRetiredRejectedPty: (id: string) => void
  sendPtyExitToRenderer: (payload: { id: string; code: number; incarnationId?: string }) => void
  sendPtySpawnedToRenderer: (id: string) => void
  finishPtyShutdown: typeof finishPtyShutdown
  getSettings?: () => GlobalSettings | undefined
  prepareClaudeAuth?: PrepareClaudeAuth
  trustedTerminalHandleEnv: Set<string>
  retiredRejectedPtyIds: Map<string, NodeJS.Timeout>
  reversibleStopOwnersByPtyId: Map<string, number>
  mainWindow: BrowserWindow
}

export type { StablePaneOwner }
