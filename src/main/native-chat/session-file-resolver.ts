import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import type { AgentType } from '../../shared/native-chat-types'
import { resolveNativeChatTranscriptAgent } from '../../shared/native-chat-agent-support'
import { walkSessionFiles } from '../ai-vault/session-scanner-discovery'
import {
  needsWslHostResolution,
  toHostReadableTranscriptPath
} from './host-readable-transcript-path'
import { wslTranscriptFsRefusal, type WslTranscriptFsError } from './wsl-transcript-fs-gate'
import { proveClaudeTranscriptBranch } from '../claude/claude-transcript-branch-proof'

// Why: these mirror the path constants in ai-vault/session-scanner.ts. Reads
// run in the main process against the runtime's own home directory; over SSH
// the remote main resolves its local home, so we never hardcode an absolute
// user path — homedir() resolution stays runtime-relative and is
// computed per call (not at module load) so it tracks the live home.
// Why CLAUDE_CONFIG_DIR and not just homedir(): a structured Claude session pins its
// account home to `CLAUDE_CONFIG_DIR || ~/.claude` (claude-accounts/runtime-paths.ts),
// and the CLI writes its transcript under whatever home it was given. Mobile native chat
// resolves with no root override, so a default that ignored the variable read a different
// tree than the CLI wrote — a silent blackout, not an error.
// Why both roots and not just that one: adopting the variable would otherwise hide every
// transcript written before it was set. De-duped so the usual case still scans once.
function claudeProjectsDirs(): string[] {
  const candidates = [
    join(process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude'), 'projects'),
    join(homedir(), '.claude', 'projects')
  ]
  return candidates.filter((dir, index) => candidates.indexOf(dir) === index)
}

export type ResolveSessionFileOptions = {
  /** Override the Claude projects root (used by tests / isolated scans). */
  claudeProjectsDir?: string
  /** Authoritative transcript path reported by the agent hook
   *  (`providerSession.transcriptPath`). When set and the file exists, it is used
   *  directly — recent Claude Code names the transcript with a UUID that differs
   *  from the hook session_id, so the id-based glob below would miss it. */
  transcriptPath?: string
  /** Attested WSL provider-session distro. Restricts exact-path resolution to that guest. */
  wslDistro?: string
}

/**
 * Resolve the on-disk JSONL transcript path for a given agent + session id.
 *
 * Prefers the hook-reported `transcriptPath` when it exists on disk (authoritative).
 * Otherwise: Claude nests transcripts by project slug
 * (`~/.claude/projects/<slug>/<id>.jsonl`), so we glob the projects subdirs for
 * `<id>.jsonl`.
 * Returns null when no matching transcript exists.
 */
export async function resolveSessionFilePath(
  agent: AgentType,
  sessionId: string,
  options: ResolveSessionFileOptions = {},
  signal?: AbortSignal
): Promise<string | null> {
  signal?.throwIfAborted()
  if (resolveNativeChatTranscriptAgent(agent) !== 'claude') {
    return null
  }
  // Why: the hook's transcript_path is the exact file the agent is writing, so it
  // beats reconstructing a path from the session id. Route it through the host
  // readability check so a WSL guest path becomes an openable UNC on Windows;
  // stale/missing paths fall through to the id-based search.
  let unavailable: WslTranscriptFsError | undefined
  const hookPath = options.transcriptPath?.trim()
  if (hookPath && extname(hookPath) === '.jsonl') {
    try {
      const hostReadable = await toHostReadableTranscriptPath(hookPath, {
        signal,
        wslDistro: options.wslDistro
      })
      if (hostReadable) {
        return hostReadable
      }
    } catch (error) {
      // A caller abort that races the refusal stays authoritative.
      signal?.throwIfAborted()
      // Why: the id-based search may still hit; surface the refusal only when
      // it does not, so a stalled distro reads as unavailable, never "missing".
      unavailable = wslTranscriptFsRefusal(error)
    }
  }

  // A guest/UNC hook path is authoritative even when the provider did not
  // attest a distro. Never let its session id resolve to a host or other guest
  // transcript after that exact path misses.
  if (hookPath && needsWslHostResolution(hookPath)) {
    if (unavailable) {
      throw unavailable
    }
    return null
  }

  // A WSL worker may fall back to terminal evidence, but never to an id match on
  // the host or another distro after its attested exact path misses.
  if (options.wslDistro?.trim()) {
    if (unavailable) {
      throw unavailable
    }
    return null
  }

  const resolved = await resolveSessionFileById(sessionId, options, signal)
  if (!resolved && unavailable) {
    throw unavailable
  }
  return resolved
}

/** Read and validate Claude's authoritative transcript branch marker. */
export async function readClaudeTranscriptLeafUuid(
  transcriptPath: string,
  providerSessionId: string,
  previousLeafUuid: string | null = null
): Promise<string> {
  return (
    await proveClaudeTranscriptBranch({
      transcriptPath,
      providerSessionId,
      previousLeafUuid
    })
  ).leafUuid
}

async function resolveSessionFileById(
  sessionId: string,
  options: ResolveSessionFileOptions,
  signal?: AbortSignal
): Promise<string | null> {
  const trimmedId = sessionId.trim()
  if (!trimmedId) {
    return null
  }
  // An explicit root is the caller naming the exact account tree its session pinned;
  // adding a fallback there could resolve a different account's transcript.
  return resolveClaudeSessionFile(
    trimmedId,
    options.claudeProjectsDir ? [options.claudeProjectsDir] : claudeProjectsDirs(),
    signal
  )
}

async function resolveClaudeSessionFile(
  sessionId: string,
  projectsDirs: readonly string[],
  signal?: AbortSignal
): Promise<string | null> {
  const targetName = `${sessionId}.jsonl`
  for (const projectsDir of projectsDirs) {
    // No existence pre-check: walkSessionFiles already yields [] for a missing root.
    const files = await walkSessionFiles(projectsDir, 'claude', [], {
      extensions: new Set(['.jsonl']),
      filePredicate: (path) => basename(path) === targetName,
      signal
    })
    if (files[0]) {
      return files[0]
    }
  }
  return null
}
