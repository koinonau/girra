import type { AiVaultSession } from '../../shared/ai-vault-types'
import { inSessionParseFileLane } from './session-parse-file-lane'
import { createMessageGraphSessionResumeState } from './session-scanner-graph-parsers'
import { createClaudeSessionResumeState } from './session-scanner-primary-parsers'
import { countSubagentTranscripts } from './session-scanner-subagent-transcripts'
import type { ResumableSessionParseState, SessionFileCandidate } from './session-scanner-types'
import {
  getSessionParseCacheEntry,
  storeSessionParseCacheEntry,
  type SessionParseCacheEntry
} from './session-parse-cache-store'
import type { TranscriptMessageSink } from './session-transcript-consumers'
import {
  readResumableTranscript,
  readWholeTranscript,
  requestWholeTranscriptRead,
  type TranscriptReadStats
} from './session-transcript-reader'

export {
  invalidateSessionParseCacheEntry,
  resetSessionParseCacheForTests,
  seedSessionParseCache,
  snapshotSessionParseCacheForPersistence,
  type PersistedSessionParseCacheEntry
} from './session-parse-cache-store'

// Incremental append-parsing applies only to transcripts that are append-only
// JSONL line-folds. OpenCode reads SQLite rows or a doc plus a message dir, so
// it keeps unchanged-file reuse only and re-parses whole when it changes.
// Returns a factory (not a state) so steady-state resumes, which clone the
// cached state instead, never pay for a throwaway accumulator.
function resumableStateFactoryFor(
  candidate: SessionFileCandidate
): ((messages: TranscriptMessageSink) => ResumableSessionParseState) | null {
  switch (candidate.agent) {
    case 'claude':
      return (messages) => createClaudeSessionResumeState(candidate.file, messages)
    case 'pi':
      return (messages) => createMessageGraphSessionResumeState(candidate.file, messages)
    case 'opencode':
      return null
  }
}

export type SessionParseStats = TranscriptReadStats & {
  reused: number
}

export function createSessionParseStats(): SessionParseStats {
  return { reused: 0, incremental: 0, fullParses: 0, bytesRead: 0 }
}

/**
 * The session list's cursor over the transcript reader: it remembers what each
 * file looked like when it was last listed, reuses that work where the file is
 * provably unchanged (mtime+size), and otherwise asks the reader to resume from
 * the last consumed byte or re-read the file whole. This is what keeps the
 * renderer's ~5s forced rescans from re-reading gigabytes of transcripts
 * (STA-1278/STA-1417: main process pegging one core during multi-agent
 * workloads). Other consumers of the reader keep their own equivalent cursor
 * and never consult this one.
 */
export async function parseAgentSessionFileCached(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform,
  stats?: SessionParseStats,
  requireRead?: SessionParseReadRequirement
): Promise<AiVaultSession | null> {
  // The whole lookup-read-store sequence runs in the lane: a concurrent parse of
  // the same path shares this entry's resume point and its message channel.
  return inSessionParseFileLane(candidate.file.path, () =>
    parseCachedInLane(candidate, platform, stats, requireRead)
  )
}

/**
 * What a caller other than the session list needs out of this parse.
 *
 * `any`: some bytes must be read. A cursor already at the file's current stat
 * is dropped so the reader opens it; one that is merely behind is left alone,
 * because an append is a read.
 *
 * `whole`: the file must be re-read from zero, for a consumer whose own cursor
 * covers a span this one does not.
 *
 * Why it is a parameter and not two calls around this one: the decision reads
 * cache state and then changes it, so outside the per-path lane an overlapping
 * list parse can store its entry in between and the forced read silently
 * degrades to a reuse.
 */
export type SessionParseReadRequirement = 'any' | 'whole'

/**
 * True when this cursor already sits at the transcript's current stat, so a
 * parse would reuse the cached fold and read no bytes at all.
 */
function sessionParseCacheCoversTranscript(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform
): boolean {
  const { file } = candidate
  const entry = getSessionParseCacheEntry(file.path)
  return (
    entry !== undefined &&
    entry.platform === platform &&
    entry.mtimeMs === file.mtimeMs &&
    (entry.sizeBytes === null || file.sizeBytes === undefined || entry.sizeBytes === file.sizeBytes)
  )
}

async function parseCachedInLane(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform,
  stats?: SessionParseStats,
  requireRead?: SessionParseReadRequirement
): Promise<AiVaultSession | null> {
  const { file } = candidate
  if (
    requireRead === 'whole' ||
    (requireRead === 'any' && sessionParseCacheCoversTranscript(candidate, platform))
  ) {
    requestWholeTranscriptRead(file.path)
  }
  const entry = getSessionParseCacheEntry(file.path)

  if (entry !== undefined && sessionParseCacheCoversTranscript(candidate, platform)) {
    return reuseCachedSession(candidate, entry, stats)
  }

  const stateFactory = resumableStateFactoryFor(candidate)
  if (stateFactory) {
    const read = await readResumableTranscript({
      candidate,
      platform,
      resume: entry?.platform === platform ? entry.resume : null,
      stateFactory,
      stats
    })
    storeSessionParseCacheEntry(file.path, {
      mtimeMs: file.mtimeMs,
      sizeBytes: file.sizeBytes ?? null,
      platform,
      session: read.session,
      resume: read.resume
    })
    return read.session
  }

  const session = await readWholeTranscript({ candidate, platform, stats })
  storeSessionParseCacheEntry(file.path, {
    mtimeMs: file.mtimeMs,
    sizeBytes: file.sizeBytes ?? null,
    platform,
    session,
    resume: null
  })
  return session
}

async function reuseCachedSession(
  candidate: SessionFileCandidate,
  entry: SessionParseCacheEntry,
  stats?: SessionParseStats
): Promise<AiVaultSession | null> {
  if (stats) {
    stats.reused++
  }
  // A zero-turn transcript usually never changes again, but its sibling
  // `<session>/subagents/` dir can gain files after the parent's last write (a
  // still-running subagent finishing). The mtime+size key can't see that, so
  // refresh the cheap directory count on reuse.
  if (entry.session && entry.session.messageCount === 0 && candidate.agent === 'claude') {
    const subagentTranscriptCount = await countSubagentTranscripts(candidate.file.path)
    if (subagentTranscriptCount !== entry.session.subagentTranscriptCount) {
      entry.session = { ...entry.session, subagentTranscriptCount }
    }
  }
  storeSessionParseCacheEntry(candidate.file.path, entry)
  return entry.session
}
