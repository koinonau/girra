import type { ParsedAgentStatusPayload } from '../agent-status-types'
import type { AgentHookSource } from '../agent-hook-relay'
import { readFirstString } from './interactive-tool'
import type { HookListenerState } from './listener-state'
import type { ExtractedPromptText } from './prompt-fields'
import { normalizeClaudeEvent } from './providers/claude-events'
import { normalizeCodexEvent } from './providers/codex-events'
import { normalizeOpenCodeFamilyEvent } from './providers/opencode-family-events'
import { normalizePiCompatibleEvent } from './providers/pi-family-events'

export type ProviderDispatchResult = {
  payload: ParsedAgentStatusPayload | null
  promptInteractionKey?: string
}

/** Exhaustive provider routing with provider-specific prompt attribution. */
export function normalizeProviderEvent(input: {
  state: HookListenerState
  source: AgentHookSource
  eventName: unknown
  promptText: string
  paneKey: string
  hookPayload: Record<string, unknown>
  extractedPrompt: ExtractedPromptText
}): ProviderDispatchResult {
  const { state, source, eventName, promptText, paneKey, hookPayload, extractedPrompt } = input
  let promptInteractionKey: string | undefined
  let payload: ParsedAgentStatusPayload | null

  switch (source) {
    case 'claude':
      payload = normalizeClaudeEvent(state, eventName, promptText, paneKey, hookPayload)
      break
    case 'codex':
      payload = normalizeCodexEvent(state, eventName, promptText, paneKey, hookPayload)
      break
    case 'opencode': {
      if (extractedPrompt.source === 'role_user_text') {
        const messageId = readFirstString(hookPayload, ['messageID', 'messageId', 'message_id'])
        promptInteractionKey = messageId ? `opencode-message-${messageId}` : undefined
      }
      payload = normalizeOpenCodeFamilyEvent(state, eventName, promptText, paneKey, hookPayload)
      break
    }
    case 'pi':
    case 'omp':
    case 'prime-agent':
      payload = normalizePiCompatibleEvent(
        state,
        source,
        eventName,
        promptText,
        paneKey,
        hookPayload
      )
      break
  }

  return { payload, promptInteractionKey }
}
