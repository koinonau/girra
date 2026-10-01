/**
 * Girra keeps per-user state in `~/.girra`: hook scripts, keybindings, credential
 * stores, relay sessions. Orca kept the same tree in `~/.orca`.
 *
 * Upstream Orca stays installed and running beside Girra, and owns `~/.orca`, so
 * the desktop resolves `~/.girra` and nothing else. Only a process that never ran
 * a migration and may predate the rename reads the legacy tree: the relay on an
 * SSH host, and a headless `orcad`. See `docs/adr/0004-leave-the-orca-home-tree-alone.md`.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME_DIR_NAME = '.girra'
const LEGACY_HOME_DIR_NAME = '.orca'

// Why cached: `resolveUserDataPath` resolves this per app-path lookup, and the
// fallback makes two synchronous filesystem calls. Keyed on the home it resolved
// from, so a changed HOME re-resolves.
let cachedFallback: { home: string; resolved: string } | null = null

/** `~/.girra`. Never `~/.orca`, which upstream Orca owns. */
export function getGirraHomeDir(home?: string): string {
  return join(home ?? homedir(), HOME_DIR_NAME)
}

/**
 * `~/.girra`, or the `~/.orca` it replaced while that is the only tree present.
 *
 * Only for a process that runs no migration and whose state may predate the
 * rename. The desktop must not call it: reading Orca's tree there means sharing
 * its credential stores and its hook-install lock with a running Orca.
 */
export function getGirraHomeDirWithLegacyFallback(home?: string): string {
  const base = home ?? homedir()
  if (cachedFallback?.home === base) {
    return cachedFallback.resolved
  }
  const current = join(base, HOME_DIR_NAME)
  const legacy = join(base, LEGACY_HOME_DIR_NAME)
  const resolved = existsSync(current) || !existsSync(legacy) ? current : legacy
  cachedFallback = { home: base, resolved }
  return resolved
}
