import type { ToolSnapshot } from '../listener-event'
import { isAskUserQuestionTool } from '../../agent-question-answered-intent'
import { deriveToolInputPreview, hasOwnField, readString, toolUpdate } from '../tool-input-preview'
import { clearActiveToolFieldsUpdate, deriveInteractivePrompt } from '../interactive-tool'

export function extractPiToolFields(
  eventName: unknown,
  hookPayload: Record<string, unknown>
): ToolSnapshot {
  // Why: arbitrary modals are not tool approvals or structured question cards.
  if (
    hookPayload.ui_prompt_active === true ||
    eventName === 'ui_prompt_start' ||
    eventName === 'ui_prompt_end'
  ) {
    // Why: the reply is the agent's own text, not modal content, so a turn that finishes
    // while a dialog is open must not leave the preview stuck on the previous message.
    const assistantText =
      eventName === 'message_end' && hookPayload.role === 'assistant'
        ? readString(hookPayload, 'text')
        : undefined
    return assistantText
      ? { ...clearActiveToolFieldsUpdate(), lastAssistantMessage: assistantText }
      : clearActiveToolFieldsUpdate()
  }
  if (
    eventName === 'tool_call' ||
    eventName === 'tool_execution_start' ||
    eventName === 'tool_execution_end'
  ) {
    const toolName = readString(hookPayload, 'tool_name')
    const rawToolInput = hookPayload.tool_input
    const toolInput = deriveToolInputPreview(toolName, rawToolInput)
    const interactivePrompt =
      isAskUserQuestionTool(toolName) &&
      (eventName === 'tool_call' || eventName === 'tool_execution_start')
        ? deriveInteractivePrompt(toolName, rawToolInput, eventName)
        : undefined
    return toolUpdate(
      { toolName, toolInput, interactivePrompt },
      { hasToolInputField: hasOwnField(hookPayload, 'tool_input') }
    )
  }
  if (eventName === 'message_end' && hookPayload.role === 'assistant') {
    const text = readString(hookPayload, 'text')
    if (text) {
      return { lastAssistantMessage: text }
    }
  }
  return {}
}
