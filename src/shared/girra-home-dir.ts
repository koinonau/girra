/**
 * Girra keeps per-user state in `~/.girra`: hook scripts, keybindings, credential
 * stores, relay sessions. Orca kept the same tree in `~/.orca`.
 *
 * The resolver reads whichever exists, so a build that has not migrated yet, and
 * the CLI and relay processes that never run the migration, all still find the
 * state. `migrateLegacyGirraHomeDir` does the move once, at desktop startup.
 *
 * Moving the tree orphans absolute paths written into an agent's config, so the
 * caller pairs it with `rewriteLegacyManagedHookPaths`.
 */
import { existsSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME_DIR_NAME = '.girra'
const LEGACY_HOME_DIR_NAME = '.orca'

export type GirraHomeDirMigration = 'moved' | 'already-migrated' | 'nothing-to-move' | 'failed'

// Why cached: hook-script refresh resolves this per call and must make no
// synchronous filesystem call on the main thread. Keyed on the home it resolved
// from, so a changed HOME re-resolves; the startup migration clears it outright.
let cached: { home: string; resolved: string } | null = null

/** `~/.girra`, or the `~/.orca` it replaces while that is the only one present. */
export function getGirraHomeDir(home?: string): string {
  const base = home ?? homedir()
  if (cached?.home === base) {
    return cached.resolved
  }
  const current = join(base, HOME_DIR_NAME)
  const legacy = join(base, LEGACY_HOME_DIR_NAME)
  const resolved = existsSync(current) || !existsSync(legacy) ? current : legacy
  cached = { home: base, resolved }
  return resolved
}

/** Drop the cache after the tree moves. */
export function resetGirraHomeDirCache(): void {
  cached = null
}

export function getLegacyGirraHomeDir(home: string = homedir()): string {
  return join(home, LEGACY_HOME_DIR_NAME)
}

/**
 * Move `~/.orca` to `~/.girra`, once.
 *
 * Why a rename and not a copy: the tree holds the live credential stores and the
 * hook install lock, so two copies diverge the moment either is written. Why it
 * refuses when both exist: that means an older build recreated `~/.orca` after a
 * migration, and merging the two without knowing which is current would lose
 * whichever it overwrote.
 */
export function migrateLegacyGirraHomeDir(home: string = homedir()): GirraHomeDirMigration {
  const current = join(home, HOME_DIR_NAME)
  const legacy = join(home, LEGACY_HOME_DIR_NAME)
  if (!existsSync(legacy)) {
    return existsSync(current) ? 'already-migrated' : 'nothing-to-move'
  }
  if (existsSync(current)) {
    return 'failed'
  }
  try {
    renameSync(legacy, current)
    resetGirraHomeDirCache()
    return 'moved'
  } catch {
    return 'failed'
  }
}
