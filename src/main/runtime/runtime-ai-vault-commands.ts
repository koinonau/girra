import type {
  AiVaultSessionTitleRequest,
  AiVaultSessionTitlesResult
} from '../../shared/ai-vault-session-title'
import type { AiVaultListArgs, AiVaultListResult } from '../../shared/ai-vault-types'
import { listAiVaultSessions } from '../ai-vault/cached-session-list'
import { resolveLocalAiVaultSessionTitles } from '../ai-vault/session-title-resolver'

export class RuntimeAiVaultCommands {
  list(args?: AiVaultListArgs): Promise<AiVaultListResult> {
    return listAiVaultSessions(args)
  }

  resolveTitles(
    requests: AiVaultSessionTitleRequest[],
    signal?: AbortSignal
  ): Promise<AiVaultSessionTitlesResult> {
    return resolveLocalAiVaultSessionTitles(requests, signal)
  }
}
