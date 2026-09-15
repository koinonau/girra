import {
  agentJournalSubmissionKey,
  parseAgentJournalItemKey
} from '../../../shared/agent-session-journal-item-key'
import { agentSessionProviderHandleChainHead } from '../../../shared/agent-session-provider-handle'
import type {
  AgentSessionRewindParams,
  AgentSessionRewindRecord,
  AgentSessionRewindResult
} from '../../../shared/agent-session-rewind'
import type { AgentSessionMutationResult } from '../../../shared/agent-session-wire'
import { AGENT_SESSION_HISTORY_MAX_PAGE_BYTES } from './agent-session-history-page-bounds'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-host-mutations'
import type { StructuredAgentSessionAttachContext } from './structured-agent-session-attach-context'
import type { StructuredAgentSessionCaller } from './structured-agent-session-host-types'
import { admitAndRunAgentSessionMutation } from './structured-agent-session-mutation-admission'
import { conversationCommandBlocked } from './structured-conversation-command-admission'
import { rewindRefusal } from './structured-rewind-refusal'
import { persistRewindRecord, recoverStructuredRewind } from './structured-rewind-recovery'
import { replaceClaudeRewindOwner } from './structured-rewind-claude-owner'

export async function rewindStructuredAgentSession(
  context: StructuredAgentSessionMutationContext,
  attachContext: StructuredAgentSessionAttachContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSessionRewindParams
): Promise<AgentSessionMutationResult<AgentSessionRewindResult>> {
  const { sessionId, clientOperationId } = params.envelope
  const store = context.deps.store
  return context.serialize(sessionId, async () => {
    const result = await admitAndRunAgentSessionMutation<AgentSessionRewindResult>({
      store,
      adapter: context.deps.adapter,
      callerKey: caller.callerKey,
      envelope: params.envelope,
      journal: context.sessions.get(sessionId)?.journal,
      publish: (journal) => context.publish(sessionId, journal),
      now: context.now,
      plan: {
        method: 'agentSession.rewind',
        fields: { itemId: params.itemId, expectedEpoch: params.expectedEpoch },
        recoverUnknownFromDurableState: true,
        settledOutcome: (rewind) => ({ status: 'succeeded', sessionId, rewind }),
        replay: (_ctx, outcome) => {
          if (outcome.status === 'succeeded' && outcome.rewind) {
            return outcome.rewind
          }
          const prior = store.getRecord(sessionId)?.rewind
          return prior?.operationId === clientOperationId &&
            prior.callerKey === caller.callerKey &&
            prior.phase === 'completed' &&
            prior.epoch
            ? { itemId: prior.itemId, epoch: prior.epoch }
            : null
        },
        run: async (ctx) => {
          await attachContext.runtimeState.flushEventSink(sessionId)
          const record = store.getRecord(sessionId)!
          const support = ctx.adapter.rewindSupport?.(sessionId)
          if (!support?.supported) {
            return rewindRefusal(support?.reason ?? 'unsupported')
          }
          if (
            record.rewind?.phase === 'prepared' ||
            record.rewind?.phase === 'provider-succeeded'
          ) {
            return rewindRefusal('outcome-unknown')
          }
          if (conversationCommandBlocked(ctx, record)) {
            return rewindRefusal('busy')
          }
          if (ctx.journal.isReadOnly) {
            return rewindRefusal('unsupported')
          }
          const snapshot = ctx.journal.snapshot()
          const providerKeys = new Map(
            snapshot.submissions.flatMap((submission) =>
              submission.dispatchState === 'accepted' && submission.providerItemId
                ? [
                    [
                      agentJournalSubmissionKey(submission.clientMessageId),
                      submission.providerItemId
                    ] as const
                  ]
                : []
            )
          )
          const providerKey = (itemId: string) => providerKeys.get(itemId) ?? itemId
          if (ctx.journal.cursor().epoch !== params.expectedEpoch) {
            return rewindRefusal('stale-epoch')
          }
          const selected = snapshot.items.findIndex((item) => item.itemId === params.itemId)
          const key = selected === -1 ? null : parseAgentJournalItemKey(providerKey(params.itemId))
          const head = agentSessionProviderHandleChainHead(record.providerHandleChain)?.handle
          if (
            key?.provider !== 'claude' ||
            head?.provider !== 'claude' ||
            key.sessionId !== head.sessionId
          ) {
            return rewindRefusal('invalid-target')
          }
          const previous = snapshot.items
            .slice(0, selected)
            .map((item) => parseAgentJournalItemKey(providerKey(item.itemId)))
            .findLast(
              (identity) => identity?.provider === 'claude' && identity.sessionId === key.sessionId
            )
          if (previous?.provider !== 'claude') {
            return rewindRefusal('invalid-target')
          }
          const prompts = snapshot.items
            .slice(selected)
            .filter((item) => item.body.kind === 'message' && item.body.role === 'user')
          const prompt =
            prompts.length === 1 ? parseAgentJournalItemKey(providerKey(prompts[0]!.itemId)) : null
          const claude: Parameters<typeof replaceClaudeRewindOwner>[3] = {
            targetUuid: previous.uuid,
            previousLeafUuid: head.leafUuid ?? '',
            ...(prompt?.provider === 'claude' ? { dropsTurn: prompt.uuid } : {})
          }
          const retained = snapshot.items
            .slice(0, selected)
            .map(({ itemId, body, observedAt }) => ({
              itemId: providerKey(itemId),
              body,
              observedAt
            }))
          if (
            retained.length > 10_000 ||
            Buffer.byteLength(JSON.stringify(retained), 'utf8') >
              AGENT_SESSION_HISTORY_MAX_PAGE_BYTES
          ) {
            return rewindRefusal('history-limit')
          }
          const prepared: AgentSessionRewindRecord = {
            operationId: clientOperationId,
            callerKey: caller.callerKey,
            itemId: params.itemId,
            providerItemId: providerKey(params.itemId),
            expectedEpoch: params.expectedEpoch,
            phase: 'prepared',
            retained
          }
          await persistRewindRecord(store, sessionId, ctx.fence, prepared)
          ctx.publish()
          const provider = await replaceClaudeRewindOwner(
            attachContext,
            caller.callerKey,
            params,
            claude
          )
          const fence = store.getRecord(sessionId)!.lease.runtimeFence
          if (!provider.ok) {
            const reason = provider.refusal.rewindReason ?? 'outcome-unknown'
            if (reason !== 'outcome-unknown') {
              await persistRewindRecord(store, sessionId, fence, {
                ...prepared,
                phase: 'refused',
                reason,
                retained: []
              })
              const currentJournal = context.sessions.get(sessionId)?.journal
              if (currentJournal) {
                context.publish(sessionId, currentJournal)
              }
            }
            return rewindRefusal(reason)
          }
          await persistRewindRecord(store, sessionId, fence, {
            ...prepared,
            phase: 'provider-succeeded',
            hydrationVerified: true
          })
          const journal = context.sessions.get(sessionId)!.journal
          await attachContext.runtimeState.flushEventSink(sessionId)
          await recoverStructuredRewind(store, sessionId, journal, fence)
          context.publish(sessionId, journal)
          return { ok: true, value: { itemId: params.itemId, epoch: journal.cursor().epoch } }
        }
      }
    })
    return result.ok
      ? {
          ...result,
          fence: store.getRecord(sessionId)!.lease.runtimeFence,
          cursor: context.sessions.get(sessionId)!.journal.cursor()
        }
      : result
  })
}
