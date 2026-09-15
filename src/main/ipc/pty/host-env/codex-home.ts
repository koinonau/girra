import { normalizeRuntimePathForComparison } from '../../../../shared/cross-platform-path'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import { isAgentStatusHooksEnabled } from '../../../agent-hooks/managed-agent-hook-controls'
import type { AccountSelectionTarget } from '../../../../shared/account-selection-target'
import { isHostCodexHomeForWsl, isWslCodexHomeForHost } from '../../../pty/codex-home-wsl-env'
import { isWslShellName } from '../../../../shared/local-windows-terminal-runtime'
import { parseWslPath } from '../../../wsl'

export function shouldSkipCodexHomeEnvForWindowsShell(
  shellPath: string | undefined,
  cwd: string | undefined
): boolean {
  return isWslShellName(shellPath) || (typeof cwd === 'string' && parseWslPath(cwd) !== null)
}

export function isCodexStatusHooksEnabled(settings: GlobalSettings | undefined): boolean {
  return (
    isAgentStatusHooksEnabled(settings) && isTuiAgentEnabled('codex', settings?.disabledTuiAgents)
  )
}

// Why: with the real-home flag ON, a host system-default launch resolves to a
// null managed home. Signal the env builder to strip a nested-Orca-inherited
// override instead of injecting one, so Codex runs on the user's own ~/.codex.
export function shouldStripInheritedOrcaCodexHome(args: {
  target: AccountSelectionTarget
  selectedCodexHomePath: string | null
  skipCodexHomeEnv: boolean
  settings: GlobalSettings | undefined
}): boolean {
  return (
    args.target.runtime === 'host' && args.selectedCodexHomePath === null && !args.skipCodexHomeEnv
  )
}

export const CODEX_HOME_ENV_KEYS = ['CODEX_HOME', 'ORCA_CODEX_HOME'] as const

// Why: system-default real-home routing runs Codex on the user's own ~/.codex.
// Nested Orca panes inherit the parent's Orca-owned override; strip only that
// (CODEX_HOME matching Orca's private ORCA_CODEX_HOME marker), and always drop
// the marker so a shell-ready wrapper cannot restore the managed home. A
// user-set CODEX_HOME with no Orca marker is preserved untouched (see #8606).
export function stripInheritedOrcaCodexHomeOverride(baseEnv: Record<string, string>): void {
  for (const key of getLocalOrcaCodexHomeEnvKeysToDelete(baseEnv)) {
    delete baseEnv[key]
  }
}

// Why: in-process spawns share main's inherited environment, so equality with
// the private marker is authoritative here. Persistent daemons compare locally.
export function getLocalOrcaCodexHomeEnvKeysToDelete(env: Record<string, string>): string[] {
  const inheritedOrcaOverride = env.ORCA_CODEX_HOME ?? process.env.ORCA_CODEX_HOME
  const inheritedCodexHome = env.CODEX_HOME ?? process.env.CODEX_HOME
  const keysToDelete = ['ORCA_CODEX_HOME']
  if (inheritedOrcaOverride && inheritedCodexHome === inheritedOrcaOverride) {
    keysToDelete.push('CODEX_HOME')
  }
  return keysToDelete
}

export function getCodexSelectionTargetForPty(
  shellPath: string | undefined,
  cwd: string | undefined,
  wslDistro?: string | null
): AccountSelectionTarget {
  const wslPath = typeof cwd === 'string' ? parseWslPath(cwd) : null
  if (isWslShellName(shellPath) || wslPath) {
    return { runtime: 'wsl', wslDistro: wslPath?.distro ?? wslDistro ?? null }
  }
  return { runtime: 'host' }
}

export function getCompatibleSelectedCodexHomePath(
  target: AccountSelectionTarget,
  selectedCodexHomePath: string | null
): string | null {
  if (!selectedCodexHomePath) {
    return null
  }
  const wslInfo = parseWslPath(selectedCodexHomePath)
  if (target.runtime === 'wsl') {
    return wslInfo || !isHostCodexHomeForWsl(selectedCodexHomePath) ? selectedCodexHomePath : null
  }
  return wslInfo || (process.platform === 'win32' && isWslCodexHomeForHost(selectedCodexHomePath))
    ? null
    : selectedCodexHomePath
}

export const CODEX_RESUME_AUTH_UNAVAILABLE_MESSAGE =
  'The Codex account credentials for this session are temporarily unavailable. Try opening the terminal again.'

export function codexHomePathsEqual(left: string | null, right: string): boolean {
  return (
    left !== null &&
    normalizeRuntimePathForComparison(left) === normalizeRuntimePathForComparison(right)
  )
}
