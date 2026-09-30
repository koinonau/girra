import { homedir } from 'node:os'
import { migrateLegacyGirraHomeDir } from '../../shared/girra-home-dir'
import { rewriteLegacyManagedHookPaths } from '../agent-hooks/legacy-home-hook-path-rewrite'

/**
 * Move `~/.orca` to `~/.girra` and repoint what names it by absolute path.
 *
 * Why the two run together: between the move and the rewrite, an agent's stored
 * hook command names a script that is not there, so the pair has to be one step
 * on the startup path rather than two things that happen eventually.
 */
export function migrateGirraHomeDirOnStartup(home: string = homedir()): void {
  const migration = migrateLegacyGirraHomeDir(home)
  if (migration === 'moved') {
    const rewrite = rewriteLegacyManagedHookPaths(home)
    console.log(`[girra-home] moved ~/.orca to ~/.girra; managed hook paths ${rewrite}`)
    return
  }
  if (migration === 'failed') {
    // Why loud: the app keeps working from whichever tree the resolver finds, but
    // two trees means one of them is quietly going stale.
    console.warn('[girra-home] could not move ~/.orca to ~/.girra; both are present')
  }
}
