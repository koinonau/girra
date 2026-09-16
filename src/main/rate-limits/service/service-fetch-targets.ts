import { RateLimitServiceResultPolicy } from './service-result-policy'
import {
  isSystemDefaultClaudeAuth,
  type ClaudeRuntimeAuthPreparation,
  type MiniMaxResolvedConfig,
  type NormalizedClaudeAccountSelectionTarget,
  toErrorMessage
} from './service-types'

export abstract class RateLimitServiceFetchTargets extends RateLimitServiceResultPolicy {
  protected isSameClaudeTarget(
    left: NormalizedClaudeAccountSelectionTarget,
    right: NormalizedClaudeAccountSelectionTarget
  ): boolean {
    return left.runtime === right.runtime && left.wslDistro === right.wslDistro
  }

  protected shouldAllowClaudePtyFallback(
    authPreparation: ClaudeRuntimeAuthPreparation | undefined
  ): boolean {
    // Why: Windows hidden PTY support is less reliable than host/WSL shells.
    if (process.platform === 'win32') {
      return false
    }
    // Why: system-default Claude isn't Girra-managed; refresh may read existing OAuth but must not launch Claude and trigger auth/browser flows.
    return !isSystemDefaultClaudeAuth(authPreparation)
  }

  protected shouldAllowClaudeUsagePanelSupplement(): boolean {
    // Why: keep this supplement off on Windows where hidden PTYs are still less reliable.
    return process.platform !== 'win32'
  }

  protected resolveMiniMaxConfig(): MiniMaxResolvedConfig {
    try {
      return {
        config: this.miniMaxConfigResolver?.() ?? {
          sessionCookie: '',
          groupId: '',
          models: 'general',
          endpoint: 'overseas',
          apiKey: ''
        },
        error: null
      }
    } catch (error) {
      // Why: one unreadable cookie must not abort every provider's refresh; surface it as MiniMax-only state instead.
      return {
        config: {
          sessionCookie: '',
          groupId: '',
          models: 'general',
          endpoint: 'overseas',
          apiKey: ''
        },
        error: toErrorMessage(error)
      }
    }
  }
}
