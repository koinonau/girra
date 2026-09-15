import type { AccountSelectionTarget } from '../../../../shared/account-selection-target'
import { isWslShellName } from '../../../../shared/local-windows-terminal-runtime'
import { parseWslPath } from '../../../wsl'

export function isWslShellOrCwd(shellPath: string | undefined, cwd: string | undefined): boolean {
  return isWslShellName(shellPath) || (typeof cwd === 'string' && parseWslPath(cwd) !== null)
}

export function getAccountSelectionTargetForPty(
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
