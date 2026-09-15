import type { AiVaultSession } from '../../shared/ai-vault-types'
import { parseMessageGraphSessionFile } from './session-scanner-graph-parsers'
import {
  looksLikeOpenCodeSqliteCandidate,
  splitOpenCodeSqliteCandidate
} from './session-scanner-opencode-sqlite-paths'
import { parseOpenCodeSqliteSessionViaWorker } from './session-scanner-opencode-sqlite-worker-spawn'
import { parseClaudeSessionFile } from './session-scanner-primary-parsers'
import { parseOpenCodeSessionFile } from './session-scanner-opencode-parser'
import type { SessionFileCandidate } from './session-scanner-types'
import type { TranscriptMessageSink } from './session-transcript-consumers'

/**
 * False when a parser decodes its messages somewhere the channel cannot reach.
 * OpenCode's SQLite sessions are read on a worker thread, so their messages
 * never come back over the sink and the read must not be reported as complete.
 */
export function parserPublishesMessages(candidate: SessionFileCandidate): boolean {
  return candidate.agent !== 'opencode' || !looksLikeOpenCodeSqliteCandidate(candidate.file.path)
}

/**
 * Parse a single agent session file into an `AiVaultSession`. Routes to the
 * appropriate agent-specific parser based on `candidate.agent`. For OpenCode
 * SQLite candidates (synthetic `db#id` paths), routes to
 * `parseOpenCodeSqliteSession` instead of the legacy JSON parser.
 * @param candidate - The session file candidate to parse.
 * @param platform - The platform to use for resume command generation.
 * @param messages - Where the parser publishes every decoded message.
 * @returns The parsed `AiVaultSession`, or `null` if parsing fails.
 */
export async function parseAgentSessionFile(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform,
  messages?: TranscriptMessageSink
): Promise<AiVaultSession | null> {
  switch (candidate.agent) {
    case 'claude':
      return parseClaudeSessionFile(candidate.file, platform, messages)
    case 'opencode': {
      // Why: OpenCode 1.17.x sessions are read from SQLite via a synthetic
      // <dbPath>#<sessionId> candidate path. Legacy file-based sessions use
      // real filesystem paths and fall through to the JSON parser.
      const sqliteCandidate = splitOpenCodeSqliteCandidate(candidate.file.path)
      if (sqliteCandidate) {
        return parseOpenCodeSqliteSessionViaWorker({
          dbPath: sqliteCandidate.dbPath,
          sessionId: sqliteCandidate.sessionId,
          platform
        })
      }
      return parseOpenCodeSessionFile(candidate.file, platform, messages)
    }
    case 'pi':
      return parseMessageGraphSessionFile(candidate.file, platform, messages)
  }
}
