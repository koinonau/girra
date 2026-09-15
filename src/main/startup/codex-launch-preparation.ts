import { app } from 'electron'
import type { CodexHomeLaunchContext } from '../ipc/pty'
import type { AccountSelectionTarget } from '../../shared/account-selection-target'
import { markCodexProjectTrusted } from '../agent-trust-presets'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import {
  ensureRealHomeCodexHookState,
  isRealHomeCodexHookLaneUsable
} from '../codex/codex-real-home-hook-install'
import { hasCustomCodexHomeOverrideForLaunch } from '../codex/codex-real-home-path'
import { isShellStartupEnvProbeSupported } from '../pty/shell-startup-env'
import { mainProcessState as state } from './main-process-state'

// Why: Windows (no shell-startup probe) and custom CODEX_HOMEs stay off the real-home hook lane.
export function isHostCodexRealHomeSelected(launchEnv?: NodeJS.ProcessEnv): boolean {
  return isShellStartupEnvProbeSupported() && !hasCustomCodexHomeOverrideForLaunch(launchEnv)
}

export function isHostCodexRealHome(launchEnv?: NodeJS.ProcessEnv): boolean {
  return isHostCodexRealHomeSelected(launchEnv) && isRealHomeCodexHookLaneUsable()
}

/** Codex always runs on the user's own home, so launch prep injects no CODEX_HOME. */
export async function prepareCodexRuntimeHomeForLaunch(
  target?: AccountSelectionTarget,
  launchEnv?: NodeJS.ProcessEnv,
  launchContext?: CodexHomeLaunchContext
): Promise<null> {
  if (target?.runtime === 'wsl') {
    return null
  }
  if (launchContext?.launchAgent === 'codex' && launchContext.workspacePath) {
    try {
      // Why: renderer quick-launch cannot await trust IPC before its PTY mounts; launch prep runs before every recognized Codex spawn.
      await markCodexProjectTrusted(launchContext.workspacePath)
    } catch (error) {
      console.warn('[codex-project-trust] failed to pre-mark launch workspace:', error)
    }
  }
  if (isHostCodexRealHomeSelected(launchEnv)) {
    // Why: the hook entry must exist, trusted by codex's own app-server grant, in ~/.codex before the pane spawns.
    await ensureRealHomeCodexHookState({
      hooksEnabled: isAgentStatusHooksEnabled(state.store?.getSettings()),
      userDataPath: app.getPath('userData')
    })
  }
  return null
}
