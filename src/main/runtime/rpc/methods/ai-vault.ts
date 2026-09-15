import { defineMethod } from '../core'
import { restampAiVaultListResult } from '../../../ai-vault/session-list-results'
import { describeAiVaultScanError } from '../../../../shared/ai-vault-scan-error-message'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import { projectStructuredAiVaultSessions } from '../../../ai-vault/structured-session-ownership'
import {
  AiVaultListSessionsParams,
  AiVaultSessionTitlesParams
} from '../../../../shared/rpc-contract/ai-vault-params'
export { AiVaultListSessionsParams, AiVaultSessionTitlesParams }

export const AI_VAULT_METHODS = [
  defineMethod({
    name: 'aiVault.resolveSessionTitles',
    params: AiVaultSessionTitlesParams,
    handler: (params, { runtime, signal }) =>
      runtime.resolveAiVaultSessionTitles(params.requests, signal)
  }),
  defineMethod({
    name: 'aiVault.listSessions',
    params: AiVaultListSessionsParams,
    handler: async (params, { runtime, clientKind, clientCapabilities }) => {
      await runtime.ensureStructuredAgentSessionHost()
      let result
      try {
        result = await runtime.listAiVaultSessions({
          limit: params.unlimited ? undefined : params.limit,
          unlimited: params.unlimited,
          force: params.force,
          scopePaths: params.scopePaths
        })
      } catch (error) {
        if (error instanceof Error) {
          error.message = describeAiVaultScanError(error.message)
          throw error
        }
        throw new Error(describeAiVaultScanError(String(error)))
      }
      // Why: web clients consume this response directly (no parent-side retag),
      // so sessions must come back stamped as the runtime host they addressed.
      const stamped = params.executionHostId
        ? restampAiVaultListResult(result, params.executionHostId)
        : result
      return projectStructuredAiVaultSessions(
        stamped,
        clientKind === undefined ||
          (clientCapabilities?.includes(STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY) ?? false)
      )
    }
  })
]
