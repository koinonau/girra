/**
 * Girra's environment variables are named `GIRRA_*`. Orca's were `ORCA_*`, and
 * both names have to work for a while: a user's shell profile, an SSH host's
 * installed CLI shim, and an agent hook script written by an older build all
 * still speak `ORCA_*`.
 *
 * Two directions, one rule each.
 *
 * `adoptLegacyOrcaEnvNames` runs once per process entry point, before anything
 * reads the environment, so a single loop covers every `GIRRA_*` read in the
 * codebase instead of a fallback at each call site. An explicit `GIRRA_*` wins,
 * because a caller that set both meant the new one.
 *
 * `withLegacyOrcaEnvAliases` goes the other way, for a child that may be an
 * older reader. Retire it once no supported host predates the rename.
 *
 * Node-free on purpose: `src/shared/**` is in the web build graph.
 */

const LEGACY_PREFIX = 'ORCA_'
const PREFIX = 'GIRRA_'

export type EnvRecord = Record<string, string | undefined>

/** Mirror every `ORCA_*` onto its `GIRRA_*` name, in place, without overwriting. */
export function adoptLegacyOrcaEnvNames(env: EnvRecord): void {
  for (const [name, value] of Object.entries(env)) {
    const renamed = renameLegacy(name)
    if (renamed !== null && value !== undefined && env[renamed] === undefined) {
      env[renamed] = value
    }
  }
}

/** Copy `env` with an `ORCA_*` alias beside every `GIRRA_*`, for older children. */
export function withLegacyOrcaEnvAliases<T extends EnvRecord>(env: T): T {
  const aliased = { ...env } as EnvRecord
  for (const [name, value] of Object.entries(env)) {
    const legacy = legacyNameFor(name)
    if (legacy !== null && value !== undefined && aliased[legacy] === undefined) {
      aliased[legacy] = value
    }
  }
  return aliased as T
}

function renameLegacy(name: string): string | null {
  return name.length > LEGACY_PREFIX.length && name.startsWith(LEGACY_PREFIX)
    ? `${PREFIX}${name.slice(LEGACY_PREFIX.length)}`
    : null
}

function legacyNameFor(name: string): string | null {
  return name.length > PREFIX.length && name.startsWith(PREFIX)
    ? `${LEGACY_PREFIX}${name.slice(PREFIX.length)}`
    : null
}
