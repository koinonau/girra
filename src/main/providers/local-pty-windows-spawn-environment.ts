import { win32 as pathWin32 } from 'node:path'
import { ORCA_HERMES_STARTUP_QUERY_ENV } from '../../shared/hermes-startup-query'
import { addWslEnvKeys } from '../wsl-env'
import type { LocalPtyLaunchPlan } from './local-pty-launch-plan'

export function finalizeWindowsLocalPtySpawnEnvironment(args: {
  plan: LocalPtyLaunchPlan
  env: Record<string, string>
}): void {
  const { plan, env } = args
  if (pathWin32.basename(plan.shellPath).toLowerCase() === 'wsl.exe') {
    if (env.CLAUDE_CONFIG_DIR) {
      // Why: managed WSL Claude passes a Linux CLAUDE_CONFIG_DIR through wsl.exe; non-default vars need WSLENV import.
      addWslEnvKeys(env, ['CLAUDE_CONFIG_DIR'])
    }
    if (env[ORCA_HERMES_STARTUP_QUERY_ENV] !== undefined) {
      // Why: wsl.exe drops custom Windows env vars; the startup wrapper needs this imported inside WSL.
      addWslEnvKeys(env, [ORCA_HERMES_STARTUP_QUERY_ENV])
    }
  }
}
