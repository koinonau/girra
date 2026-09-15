import { restoreRewindJournalBody } from './structured-rewind-journal-body'
import { isDeepStrictEqual } from 'node:util'
import {
  agentJournalItemKey,
  parseAgentJournalItemKey
} from '../../../shared/agent-session-journal-item-key'
import type { AgentSessionRewindRecord } from '../../../shared/agent-session-rewind'
import type { AgentSessionRecordStore } from '../../runtime/agent-session-record-store'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'

export function persistRewindRecord(
  store: AgentSessionRecordStore,
  sessionId: string,
  fence: number,
  rewind: AgentSessionRewindRecord
): Promise<unknown> {
  return store.transitionHandoff(sessionId, (record) => {
    if (record.lease.runtimeFence !== fence) {
      throw new Error('agent_session_checkpoint_stale')
    }
    return { ...record, rewind }
  })
}

/** Recovery observes provider state; it never repeats an ambiguous native mutation. */
export async function recoverStructuredRewind(
  store: AgentSessionRecordStore,
  sessionId: string,
  journal: AgentSessionJournal,
  fence: number
): Promise<void> {
  const rewind = store.getRecord(sessionId)?.rewind
  if (rewind?.phase !== 'provider-succeeded') {
    return
  }
  const replacement = rewind.retained.map((item) => {
    const identity = parseAgentJournalItemKey(item.itemId)
    if (!identity) {
      throw new Error('agent_session_rewind:invalid-retained-identity')
    }
    return { identity, body: restoreRewindJournalBody(item.body), observedAt: item.observedAt }
  })
  // A crash after the journal transaction must settle its existing epoch, not replace it twice.
  const alreadyReplaced = journal.cursor().epoch !== rewind.expectedEpoch
  if (
    alreadyReplaced &&
    !isDeepStrictEqual(
      journal.snapshot().items.map(({ itemId, body }) => ({ itemId, body })),
      replacement.map(({ identity, body }) => ({ itemId: agentJournalItemKey(identity), body }))
    )
  ) {
    throw new Error('agent_session_rewind:stale-epoch')
  }
  const cursor = alreadyReplaced
    ? journal.cursor()
    : await journal.replaceEpochItems('handle_forked', fence, replacement)
  await persistRewindRecord(store, sessionId, fence, {
    ...rewind,
    phase: 'completed',
    epoch: cursor.epoch,
    retained: []
  })
  await store.recordOperationOutcome({
    callerKey: rewind.callerKey,
    operationId: rewind.operationId,
    outcome: {
      status: 'succeeded',
      sessionId,
      rewind: { itemId: rewind.itemId, epoch: cursor.epoch }
    }
  })
}
