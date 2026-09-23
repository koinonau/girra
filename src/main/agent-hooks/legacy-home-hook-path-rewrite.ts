/**
 * Repoint an agent's installed hooks after `~/.orca` becomes `~/.girra`.
 *
 * The agent's settings file stores the hook script by absolute path, so the move
 * leaves it naming a script that no longer exists. The agent then runs nothing,
 * fails soft, and the sidebar simply stops updating. Rewriting the stored paths
 * is what makes the move invisible.
 *
 * Text substitution rather than a walk of the hook tree: a command is a shell
 * string with the path quoted or wrapped inside it, differently per platform,
 * and every one of those forms contains the directory verbatim.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getGirraHomeDir, getLegacyGirraHomeDir } from '../../shared/girra-home-dir'
import { writeHooksJson, type HooksConfig } from './installer-utils'

export type LegacyHookPathRewrite = 'rewritten' | 'nothing-to-rewrite' | 'failed'

/** Every agent config file that can name a managed hook script by absolute path. */
const AGENT_SETTINGS_RELATIVE_PATHS = [join('.claude', 'settings.json')]

export function rewriteLegacyManagedHookPaths(home: string): LegacyHookPathRewrite {
  const legacyDir = getLegacyGirraHomeDir(home)
  const currentDir = getGirraHomeDir(home)
  if (legacyDir === currentDir) {
    return 'nothing-to-rewrite'
  }
  let rewroteAny = false
  for (const relativePath of AGENT_SETTINGS_RELATIVE_PATHS) {
    const settingsPath = join(home, relativePath)
    if (!existsSync(settingsPath)) {
      continue
    }
    let raw: string
    try {
      raw = readFileSync(settingsPath, 'utf-8')
    } catch {
      return 'failed'
    }
    // Why serialize first: the stored path is JSON-escaped, and on Windows that
    // means doubled backslashes, so the substitution has to run on that form.
    const serializedLegacy = JSON.stringify(legacyDir).slice(1, -1)
    const serializedCurrent = JSON.stringify(currentDir).slice(1, -1)
    if (!raw.includes(serializedLegacy)) {
      continue
    }
    let config: HooksConfig
    try {
      config = JSON.parse(raw.replaceAll(serializedLegacy, serializedCurrent)) as HooksConfig
    } catch {
      return 'failed'
    }
    try {
      writeHooksJson(settingsPath, config, { preserveMode: true })
      rewroteAny = true
    } catch {
      return 'failed'
    }
  }
  return rewroteAny ? 'rewritten' : 'nothing-to-rewrite'
}
