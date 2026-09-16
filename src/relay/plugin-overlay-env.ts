import { readSessionShellStartupEnvVar } from '../main/pty/shell-startup-env'

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0)
}

function readStartupEnv(
  name: string,
  env: Record<string, string>,
  shell: string | undefined
): string | undefined {
  // Why the session env first: it is closer to the user's shell than the relay
  // process env, and fish config lives under its XDG_CONFIG_HOME.
  return readSessionShellStartupEnvVar(name, env, shell)
}

export function resolveOpenCodeSourceConfigDir(
  env: Record<string, string>,
  shell: string | undefined
): string | undefined {
  return firstNonEmpty(
    env.ORCA_OPENCODE_SOURCE_CONFIG_DIR,
    readStartupEnv('OPENCODE_CONFIG_DIR', env, shell),
    env.OPENCODE_CONFIG_DIR
  )
}

export function resolvePiSourceAgentDir(
  env: Record<string, string>,
  shell: string | undefined
): string | undefined {
  const sourceDir = firstNonEmpty(env.ORCA_PI_SOURCE_AGENT_DIR)
  if (sourceDir) {
    return sourceDir
  }

  const startupDir = readStartupEnv('PI_CODING_AGENT_DIR', env, shell)
  if (startupDir) {
    return startupDir
  }

  // Why: a matching Girra overlay shadow means this shell inherited an old PTY
  // overlay. Do not remirror it; let plugin-overlay default to ~/.pi/agent.
  if (env.PI_CODING_AGENT_DIR && env.PI_CODING_AGENT_DIR !== env.ORCA_PI_CODING_AGENT_DIR) {
    return env.PI_CODING_AGENT_DIR
  }
  return undefined
}
