import { homedir } from 'node:os'
import { dirname, extname, join, relative } from 'node:path'
import type { AiVaultAgent } from '../../shared/ai-vault-types'
import type { AiVaultDeletableAgent } from '../../shared/ai-vault-session-deletion'
import { claudeProjectsRootDirs, sessionRootDirs } from './session-scanner-roots'
import { SUBAGENT_DIR_NAME } from './session-scanner-subagent-transcripts'
import type { AiVaultScanOptions } from './session-scanner-types'
import { normalizeAgentSessionsDir } from './session-scanner-values'

const PI_SESSIONS_DIR = normalizeAgentSessionsDir(
  process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), '.pi', 'agent', 'sessions'),
  '.pi'
)

/**
 * Where one agent's session files live and which of them count as sessions.
 *
 * The scanner walks these roots to list sessions; the delete validator accepts
 * only paths this same shape would have surfaced. Both read this one table, so
 * "deletable" and "discoverable" cannot drift apart.
 */
export type AiVaultAgentSource = {
  // Returns the local host root plus one per WSL distro home.
  rootDirs: (options: AiVaultScanOptions, wslHomeDirs: readonly string[]) => string[]
  extensions: readonly string[]
  filePredicate?: (filePath: string) => boolean
  // Return false to skip a directory; depth 0 is a child of the root.
  directoryPredicate?: (name: string, depth: number) => boolean
}

// Every deletable agent needs an entry — the delete validator derives its roots
// and its accept rule from this table alone, so adding an agent to
// AI_VAULT_DELETABLE_AGENTS without a source here is a type error.
type AiVaultAgentSourceTable = Record<AiVaultDeletableAgent, AiVaultAgentSource> &
  Partial<Record<AiVaultAgent, AiVaultAgentSource>>

// OpenCode is absent: its SQLite and legacy file shapes have their own scanner.
export const AI_VAULT_AGENT_SOURCES: AiVaultAgentSourceTable = {
  claude: {
    rootDirs: (options, wslHomeDirs) =>
      claudeProjectsRootDirs({ claudeProjectsDir: options.claudeProjectsDir, wslHomeDirs }),
    extensions: ['.jsonl'],
    // Why: Task subagent transcripts under `<session>/subagents/` share the parent
    // sessionId and aren't independently resumable, so they'd just duplicate the
    // parent as untitled rows; prune the subtree and read them on demand under
    // their parent instead.
    directoryPredicate: (name) => name !== SUBAGENT_DIR_NAME
  },
  pi: {
    rootDirs: (options, wslHomeDirs) =>
      sessionRootDirs(options.piSessionsDir ?? PI_SESSIONS_DIR, wslHomeDirs, [
        '.pi',
        'agent',
        'sessions'
      ]),
    extensions: ['.jsonl']
  }
}

/**
 * Whether a scan rooted at `rootDir` would surface `filePath`: its extension,
 * its file predicate, and every directory between the two passing the directory
 * predicate. This is the delete validator's accept rule, so a path no scan
 * would ever list can't become a delete target either.
 */
export function isDiscoverableSessionFile(
  source: AiVaultAgentSource,
  rootDir: string,
  filePath: string
): boolean {
  if (!source.extensions.includes(extname(filePath).toLowerCase())) {
    return false
  }
  if (source.filePredicate && !source.filePredicate(filePath)) {
    return false
  }
  const { directoryPredicate } = source
  if (!directoryPredicate) {
    return true
  }
  // Indexed like walkSessionFiles: depth 0 is a child of rootDir.
  return pathSegments(relative(rootDir, dirname(filePath)))
    .filter(Boolean)
    .every((name, depth) => directoryPredicate(name, depth))
}

function pathSegments(filePath: string): string[] {
  return filePath.split(/[\\/]/)
}
