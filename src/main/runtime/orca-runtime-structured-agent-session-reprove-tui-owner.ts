// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithStructuredAgentSessionLaunchTui } from './orca-runtime-structured-agent-session-launch-tui'
import { join } from 'node:path'
import { claudeProviderHandleLink } from '../claude/claude-structured-owner-identity'
import { probeAgentSessionProcessIdentity } from './agent-session-process-identity-probe'
import { agentSessionProviderHandleRoot } from '../../shared/agent-session-provider-handle'

export class OrcaRuntimeWithStructuredAgentSessionReproveTuiOwner extends OrcaRuntimeWithStructuredAgentSessionLaunchTui {
  protected createStructuredAgentSessionReproveTuiOwnerCallback() {
    return async ({ record, owner }) => {
      const current = this.refreshStructuredTuiOwnerBinding(owner)
      const persisted = record.lease.ownerProcess
      if (
        !persisted ||
        persisted.hostId !== current.process.hostId ||
        persisted.pid !== current.process.pid ||
        persisted.processStartTimeMs !== current.process.processStartTimeMs ||
        persisted.spawnToken !== current.process.spawnToken
      ) {
        throw new Error('The owning terminal does not match the persisted launch identity.')
      }
      const proof = await probeAgentSessionProcessIdentity({ identity: current.process })
      if (proof.outcome !== 'identity-matched' || proof.matchedOn.length === 0) {
        throw new Error(
          `The owning ${current.link.handle.provider} child process could not be re-proved.`
        )
      }
      const head = record.providerHandleChain.at(-1)
      if (
        !head ||
        agentSessionProviderHandleRoot(current.link.handle) !==
          agentSessionProviderHandleRoot(head.handle)
      ) {
        throw new Error('agent_session_identity_required')
      }
      const claudeProof = await this.waitForStructuredClaudeTuiProof({
        handle: current.terminal.handle,
        paneKey: current.terminal.paneKey,
        sessionId: head.handle.sessionId,
        previousLeafUuid: head.handle.leafUuid,
        projectsDir: join(record.accountHome.path, 'projects')
      })
      return {
        ...current,
        link: claudeProviderHandleLink({
          sessionId: head.handle.sessionId,
          leafUuid: claudeProof.leafUuid,
          resumed: true,
          fence: record.lease.runtimeFence,
          observedAt: Date.now()
        }),
        transcriptPath: claudeProof.transcriptPath
      }
    }
  }
}
