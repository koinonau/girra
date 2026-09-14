import {
  isCompactContinuationUserTurnText,
  isKnownHarnessInjectedUserTurnText
} from '../harness-injected-user-turns'
import { capOpenCodeHookText } from './listener-limits'
import type { HookListenerState } from './listener-state'
import type { ToolSnapshot } from './listener-event'

// ─── Per-pane field caches + extractors ─────────────────────────────

export type ExtractedPromptText = {
  text: string
  source:
    | 'prompt'
    | 'user_prompt'
    | 'userPrompt'
    | 'initial_prompt'
    | 'initialPrompt'
    | 'user_message'
    | 'message'
    | 'role_user_text'
    | null
}

export function extractPromptText(hookPayload: Record<string, unknown>): ExtractedPromptText {
  const candidateKeys = [
    'prompt',
    'user_prompt',
    'userPrompt',
    'initial_prompt',
    'initialPrompt',
    'user_message',
    'message'
  ]
  for (const key of candidateKeys) {
    const value = hookPayload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      // Why: trim so prompts match readStringField output — whitespace would otherwise leak into UI and caches.
      return { text: value.trim(), source: key as Exclude<ExtractedPromptText['source'], null> }
    }
  }
  // Why: OpenCode sends MessagePart { role, text } with no UserPromptSubmit; when role === 'user' the text is the prompt.
  if (hookPayload.role === 'user' && typeof hookPayload.text === 'string') {
    const trimmed = capOpenCodeHookText(hookPayload.text.trim())
    if (trimmed.length > 0) {
      return { text: trimmed, source: 'role_user_text' }
    }
  }
  return { text: '', source: null }
}

// Why: the post-compact continuation prompt has no matching Stop and would resurrect working.
export function shouldIgnoreCompactContinuationUserPromptSubmit(
  eventName: unknown,
  promptText: string
): boolean {
  return eventName === 'UserPromptSubmit' && isCompactContinuationUserTurnText(promptText)
}

export function resolvePrompt(
  state: HookListenerState,
  paneKey: string,
  promptText: string,
  options?: { resetOnNewTurn?: boolean }
): string {
  // Why: harness-injected turns fire UserPromptSubmit but aren't the user's ask — keep cached prompt; match only known tags so real <tags> still reset the turn.
  if (isKnownHarnessInjectedUserTurnText(promptText)) {
    return state.lastPromptByPaneKey.get(paneKey) ?? ''
  }
  if (options?.resetOnNewTurn) {
    state.lastPromptByPaneKey.delete(paneKey)
  }
  if (promptText) {
    state.lastPromptByPaneKey.set(paneKey, promptText)
    return promptText
  }
  return state.lastPromptByPaneKey.get(paneKey) ?? ''
}

export function resolveToolState(
  state: HookListenerState,
  paneKey: string,
  update: ToolSnapshot,
  options: { resetOnNewTurn: boolean }
): ToolSnapshot {
  if (options.resetOnNewTurn) {
    state.lastToolByPaneKey.delete(paneKey)
  }
  const previous = state.lastToolByPaneKey.get(paneKey) ?? {}
  // Why: undefined means either "no update" or "input not previewable"; extractor metadata decides whether to inherit stale input.
  const clearsUnpreviewableInput =
    update.hasToolInputField === true && update.toolInput === undefined
  const clearsUnidentifiedTool =
    update.hasToolUpdate === true &&
    update.toolName === undefined &&
    update.hasToolInputField === true
  const toolName = clearsUnidentifiedTool ? undefined : (update.toolName ?? previous.toolName)
  const toolInput =
    clearsUnpreviewableInput ||
    (update.toolName !== undefined &&
      update.toolName !== previous.toolName &&
      update.toolInput === undefined)
      ? undefined
      : (update.toolInput ?? previous.toolInput)
  const merged: ToolSnapshot = {
    toolName,
    toolInput,
    // Why: don't inherit previous.interactivePrompt — valid only for its one AskUserQuestion event; carrying it forward leaves a stale live card.
    interactivePrompt: update.interactivePrompt,
    lastAssistantMessage: update.clearLastAssistantMessage
      ? undefined
      : (update.lastAssistantMessage ?? previous.lastAssistantMessage),
    // Why: the provenance flag has to move with the value it describes — inherit it
    // only when the message itself is inherited, or a later prose turn keeps the
    // previous tool result's flag and stays suppressed in native chat.
    lastAssistantMessageIsToolOutput: update.clearLastAssistantMessage
      ? undefined
      : update.lastAssistantMessage === undefined
        ? previous.lastAssistantMessageIsToolOutput
        : update.lastAssistantMessageIsToolOutput
  }
  state.lastToolByPaneKey.set(paneKey, merged)
  return merged
}
