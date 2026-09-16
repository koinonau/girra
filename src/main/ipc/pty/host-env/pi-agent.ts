import { readSessionShellStartupEnvVar } from '../../../pty/shell-startup-env'
import { AGENT_HOOK_RUNTIME_ENV_KEYS, CLAUDE_CHILD_SESSION_STAMP_ENV_KEYS } from './spawn-env-keys'

export function readEnvWithProcessFallback(
  baseEnv: Record<string, string>,
  key: string
): string | undefined {
  return baseEnv[key] ?? process.env[key]
}

export function resolvePiAgentSourceDir(baseEnv: Record<string, string>): string | undefined {
  const sourceDir = readEnvWithProcessFallback(baseEnv, 'ORCA_PI_SOURCE_AGENT_DIR')
  if (sourceDir) {
    return sourceDir
  }

  const publicDir = readEnvWithProcessFallback(baseEnv, 'PI_CODING_AGENT_DIR')
  // Why: if PI_CODING_AGENT_DIR is a restored Girra overlay with no source shadow, remirroring leaks the overlay tree; fall through to defaults.
  if (publicDir && publicDir !== readEnvWithProcessFallback(baseEnv, 'ORCA_PI_CODING_AGENT_DIR')) {
    return publicDir
  }

  return readSessionShellStartupEnvVar('PI_CODING_AGENT_DIR', baseEnv)
}

export function exposePiManagedExtensionEnv(
  baseEnv: Record<string, string>,
  managedEnv: Record<string, string>
): void {
  delete baseEnv.ORCA_PI_CODING_AGENT_DIR
  if (managedEnv.ORCA_PI_SOURCE_AGENT_DIR) {
    baseEnv.ORCA_PI_SOURCE_AGENT_DIR = managedEnv.ORCA_PI_SOURCE_AGENT_DIR
  } else {
    delete baseEnv.ORCA_PI_SOURCE_AGENT_DIR
  }
}

// Why: variadic because a nested call per source made intermediate `string[] | undefined` collide with the parameter type.
export function mergePtyEnvDeletions(
  existingKeys: string[] | undefined,
  ...additionalKeyGroups: readonly (readonly string[])[]
): string[] | undefined {
  if (!existingKeys && additionalKeyGroups.every((keys) => keys.length === 0)) {
    return undefined
  }
  return Array.from(new Set([...(existingKeys ?? []), ...additionalKeyGroups.flat()]))
}

export function getInheritedAgentHookEnvKeysToDelete(
  spawnEnv: Record<string, string> | undefined
): string[] {
  const env = spawnEnv ?? {}
  // Why: providers merge process.env after cleanup; delete stale hook keys without dropping fresh coordinates buildPtyHostEnv set.
  return AGENT_HOOK_RUNTIME_ENV_KEYS.filter((key) => env[key] === undefined)
}

export function getInheritedClaudeSessionStampEnvKeysToDelete(
  spawnEnv: Record<string, string> | undefined
): string[] {
  const env = spawnEnv ?? {}
  // Why: strip only values inherited from the pty host; a caller that explicitly
  // provides a stamp (deliberately spawning a nested Claude child) keeps it.
  return CLAUDE_CHILD_SESSION_STAMP_ENV_KEYS.filter((key) => env[key] === undefined)
}

// Why: a nested terminal can inherit prior OpenCode/Pi overlay env; restore the user's recorded source dir, else strip only Girra-owned values.
export function restoreOrStripOverlayEnv(
  baseEnv: Record<string, string>,
  keys: {
    primary: string
    overlay: string
    source: string
  }
): void {
  const sourceValue = baseEnv[keys.source] ?? process.env[keys.source]
  const overlayValue = baseEnv[keys.overlay] ?? process.env[keys.overlay]
  if (sourceValue) {
    baseEnv[keys.primary] = sourceValue
  } else if (overlayValue && baseEnv[keys.primary] === overlayValue) {
    delete baseEnv[keys.primary]
  }
  delete baseEnv[keys.overlay]
  delete baseEnv[keys.source]
}

export function resolveOpenCodeSourceConfigDir(
  baseEnv: Record<string, string>
): string | undefined {
  const sourceDir =
    baseEnv.ORCA_OPENCODE_SOURCE_CONFIG_DIR ?? process.env.ORCA_OPENCODE_SOURCE_CONFIG_DIR
  if (sourceDir) {
    return sourceDir
  }

  const configDir = baseEnv.OPENCODE_CONFIG_DIR ?? process.env.OPENCODE_CONFIG_DIR
  const orcaConfigDir = baseEnv.ORCA_OPENCODE_CONFIG_DIR ?? process.env.ORCA_OPENCODE_CONFIG_DIR
  // Why: with no recorded source dir, an inherited OPENCODE_CONFIG_DIR is Girra-owned, not user config; treating it as user config makes child Orcas mirror the hook dir.
  if (configDir && orcaConfigDir && configDir === orcaConfigDir) {
    return undefined
  }

  return configDir ?? readSessionShellStartupEnvVar('OPENCODE_CONFIG_DIR', baseEnv)
}
