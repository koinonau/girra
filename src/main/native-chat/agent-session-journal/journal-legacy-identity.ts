// Identity anchors for bridge-era transcript lines.
//
// The transcript decoders return a render model, not an identity, so the import
// reads identity from the SAME raw line the decoder consumed rather than
// inferring it from decoded text.
//
// Claude gets its real identity namespace: the project jsonl IS the provider's
// store, and `uuid` survives `--fork-session` unchanged, so a later structured
// session reconciles against these keys directly.
//
// A line with no uuid falls back to the import-scoped `legacy` namespace.

import type { AgentType } from '../../../shared/agent-status-types'
import type { AgentJournalItemIdentity } from '../../../shared/agent-session-journal-types'

export type LegacyIdentityTracker = {
  /** Identity for whatever the decoder emits from this raw line. Called for
   *  every line in file order, including ones the decoder discards. */
  identify(line: string, lineIndex: number): AgentJournalItemIdentity
}

export function createLegacyIdentityTracker(input: {
  agent: AgentType
  sessionId: string
}): LegacyIdentityTracker {
  return { identify: (line, index) => claudeIdentity(line, index, input.agent, input.sessionId) }
}

function claudeIdentity(
  line: string,
  lineIndex: number,
  agent: AgentType,
  sessionId: string
): AgentJournalItemIdentity {
  const record = parseRecord(line)
  const uuid = stringField(record, 'uuid')
  if (!uuid) {
    return { provider: 'legacy', agent, sessionId, recordId: `#${lineIndex}` }
  }
  // The record's own session id wins: a forked transcript keeps the original
  // item uuids, and pairing them with the fork's id would mint new identities.
  return { provider: 'claude', sessionId: stringField(record, 'sessionId') ?? sessionId, uuid }
}

function parseRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function stringField(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') {
    return null
  }
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' && value ? value : null
}
