import type { AiVaultAgent } from './ai-vault-types'
import type { ExecutionHostId } from './execution-host'

// IPC payload for aiVault:deleteSession.
export type AiVaultDeleteSessionArgs = {
  agent: AiVaultAgent
  // Optional for mixed renderer/main versions. Main ignores this field on delete
  // (path + host + agent validation only; no identity/liveness check).
  sessionId?: string
  filePath: string
  // The session's host; only a local session may be deleted.
  executionHostId?: ExecutionHostId
}

export type AiVaultDeleteSessionResult =
  | { outcome: 'deleted' }
  | { outcome: 'rejected'; agent: AiVaultAgent; reason: AiVaultSessionDeleteRejectionCode }
  | { outcome: 'failed'; agent: AiVaultAgent; error: string }

// Agents whose sessions Girra can remove completely: everything the session
// wrote is derivable from the one path the scanner surfaced, and none of it is
// shared with another session.
//
// OpenCode is excluded: a 1.17.x session is a SQLite row, not a file.
export const AI_VAULT_DELETABLE_AGENTS = ['pi', 'claude'] as const satisfies readonly AiVaultAgent[]

export type AiVaultDeletableAgent = (typeof AI_VAULT_DELETABLE_AGENTS)[number]

export function isAiVaultDeletableAgent(agent: AiVaultAgent): agent is AiVaultDeletableAgent {
  return (AI_VAULT_DELETABLE_AGENTS as readonly AiVaultAgent[]).includes(agent)
}

// A '#' marks an OpenCode 1.17.x SQLite row's synthetic `<dbPath>#<sessionId>`
// identity — no real file to open or delete. '#' never appears in a genuine
// transcript path.
export function isAiVaultSyntheticSessionPath(filePath: string): boolean {
  return filePath.includes('#')
}

export type AiVaultSessionDeleteRejectionCode =
  | 'invalid-path'
  | 'unsupported-agent'
  | 'non-local-host'
  | 'synthetic-path'
  | 'path-outside-known-roots'
  // The scanner would never have surfaced this path as a session row, so it is
  // not a session to delete (wrong extension, or a pruned subagent transcript).
  | 'undiscoverable-path'
  // A Claude transcript stem names no session dir of its own, so removing its
  // derived dir would trash every session beside it.
  | 'no-session-directory'
  // fs-side guard: lstat disagrees with the removal's declared kind (a symlink,
  // or a file where the plan expects a directory).
  | 'unexpected-target-kind'

// One path the executor removes. A `kind` mismatch on disk is a rejection,
// never a coerced delete. `roots` are what the path's realpath must still
// resolve inside — a symlinked parent escapes the validator's textual check.
export type AiVaultSessionDeleteRemoval = {
  path: string
  kind: 'file' | 'directory'
  roots: readonly string[]
}

// CALLER CONTRACT: `allowed: true` is a path-only judgement — the validator
// never touches disk, so it can't tell a session file from a same-named
// directory or a symlink planted inside a root. Before removing anything the
// caller MUST re-check each removal's `kind` and realpath it against `roots`.
export type AiVaultSessionDeleteAllowedResult = {
  allowed: true
  agent: AiVaultDeletableAgent
  // The transcript path (also the last `removals` entry); cache invalidation
  // keys off it.
  resolvedPath: string
  // Companions first, transcript last: a failed companion leaves the row on
  // screen to retry from, where transcript-first would strand it on disk.
  removals: readonly AiVaultSessionDeleteRemoval[]
}

export type AiVaultSessionDeleteRejectedResult = {
  allowed: false
  agent: AiVaultAgent
  reason: AiVaultSessionDeleteRejectionCode
}

export type AiVaultSessionDeleteValidationResult =
  | AiVaultSessionDeleteAllowedResult
  | AiVaultSessionDeleteRejectedResult
