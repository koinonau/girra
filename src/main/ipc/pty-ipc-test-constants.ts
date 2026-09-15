import { it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { resolveWindowsShellLaunchArgs } from '../providers/windows-shell-args'

/** The narrow slice of vitest's test API these suites use; keeps `it`/`it.skip` interchangeable. */
export type PlatformGatedTest = (
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number
) => void

export const isWindowsHost = process.platform === 'win32'
export const posixOnlyIt: PlatformGatedTest = isWindowsHost ? it.skip : it
export const TEST_MANAGED_ROOT = isWindowsHost ? 'C:\\managed' : '/managed'

// Why: Windows resolves a bare PowerShell name to an absolute exe before ConPTY, else CreateProcessW fails with error 5 (PR #6537 / #5161).
export const RESOLVED_WINDOWS_POWERSHELL =
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
export const RESOLVED_PWSH7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
// Why: default spawn cwd in the Windows UTF-8 suite is USERPROFILE; derive shell
// args from the production resolver so expectations stay in lockstep when the
// PowerShell bootstrap grows (e.g. cwd restore after profiles load).
export const DEFAULT_WINDOWS_PTY_CWD = 'C:\\Users\\test'
export function powerShellOsc133ArgsForCwd(cwd: string = DEFAULT_WINDOWS_PTY_CWD): string[] {
  return resolveWindowsShellLaunchArgs(RESOLVED_WINDOWS_POWERSHELL, cwd, cwd).shellArgs
}
export const POWERSHELL_OSC133_ARGS = powerShellOsc133ArgsForCwd()

/** What node-pty's onData/onExit registrations hand back. */
export type MockDisposable = { dispose: Mock }

export function makeDisposable(): MockDisposable {
  return { dispose: vi.fn() }
}

export function makeDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}
