import type { AgentSessionLease, AgentSessionRecord } from '../../../shared/agent-session-record'

export type StructuredProviderSessionOwnership = {
  sessionId: string
  workspaceId: string
  provider: 'claude'
  providerSessionId: string
  lease: AgentSessionLease
}

export function listStructuredProviderSessionOwnership(
  records: readonly AgentSessionRecord[]
): StructuredProviderSessionOwnership[] {
  return records.flatMap((record) =>
    record.providerHandleChain.map((link) => ({
      sessionId: record.sessionId,
      workspaceId: record.location.workspaceId,
      provider: record.provider,
      providerSessionId: link.handle.sessionId,
      lease: record.lease
    }))
  )
}
