import type { ClaudeStreamJsonFrameKind } from './claude-stream-json-frame-schema'

export type ProviderFrameClassification =
  | 'timeline-substantive'
  | 'stream-into-item'
  | 'status-chrome'
  | 'suppressed-benign'
  | 'error-surface'

type ProviderFrameClassificationTable = {
  claude: Record<ClaudeStreamJsonFrameKind, ProviderFrameClassification>
}

export const PROVIDER_FRAME_CLASSIFICATIONS = {
  claude: {
    'message:assistant': 'timeline-substantive',
    'message:user': 'timeline-substantive',
    'message:result': 'status-chrome',
    'message:system:init': 'status-chrome',
    'message:stream_event:message_start': 'status-chrome',
    'message:stream_event:message_delta': 'stream-into-item',
    'message:stream_event:message_stop': 'status-chrome',
    'message:stream_event:content_block_start': 'status-chrome',
    'message:stream_event:content_block_delta': 'stream-into-item',
    'message:stream_event:content_block_stop': 'status-chrome',
    'message:system:compact_boundary': 'status-chrome',
    'message:system:status': 'status-chrome',
    'message:system:api_retry': 'status-chrome',
    'message:system:control_request_progress': 'status-chrome',
    'message:system:model_refusal_fallback': 'status-chrome',
    'message:system:model_refusal_no_fallback': 'error-surface',
    'message:system:local_command_output': 'timeline-substantive',
    'message:system:hook_started': 'suppressed-benign',
    'message:system:hook_progress': 'suppressed-benign',
    'message:system:hook_response': 'suppressed-benign',
    'message:system:plugin_install': 'status-chrome',
    'message:tool_progress': 'status-chrome',
    'message:auth_status': 'status-chrome',
    'message:system:task_notification': 'status-chrome',
    'message:system:task_started': 'status-chrome',
    'message:system:task_updated': 'status-chrome',
    'message:system:task_progress': 'status-chrome',
    'message:system:background_tasks_changed': 'status-chrome',
    'message:system:thinking_tokens': 'status-chrome',
    'message:system:session_state_changed': 'status-chrome',
    'message:system:worker_shutting_down': 'status-chrome',
    'message:system:commands_changed': 'status-chrome',
    'message:system:notification': 'status-chrome',
    'message:system:files_persisted': 'status-chrome',
    'message:tool_use_summary': 'timeline-substantive',
    'message:system:memory_recall': 'timeline-substantive',
    'message:rate_limit_event': 'status-chrome',
    'message:system:elicitation_complete': 'status-chrome',
    'message:system:permission_denied': 'error-surface',
    'message:prompt_suggestion': 'status-chrome',
    'message:system:mirror_error': 'error-surface',
    'message:system:informational': 'timeline-substantive',
    'message:conversation_reset': 'status-chrome',
    // A `started`/`completed`/`cancelled` state for one queued command uuid and
    // nothing else; the CLI keeps it out of its own transcript too. A state that
    // reads as a failure still surfaces, via the payload check in classify.
    'message:command_lifecycle': 'status-chrome',
    // The turn-complete signal: lifecycle, never a transcript row. Error subtypes
    // included — the turn's assistant frames already carry any user-facing text.
    'message:result:success': 'status-chrome',
    'message:result:error_during_execution': 'status-chrome',
    'message:result:error_max_turns': 'status-chrome',
    'message:result:error_max_budget_usd': 'status-chrome',
    'message:result:error_max_structured_output_retries': 'status-chrome'
  }
} as const satisfies ProviderFrameClassificationTable

const ERROR_VARIANT_KEYS = new Set(['type', 'status', 'state', 'subtype', 'outcome'])
const ERROR_VALUE_KEYS = new Set(['error', 'failureReason', 'failure_reason'])

function isErrorVariant(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.replace(/[_\s-]/g, '').toLowerCase()
  return (
    normalized.startsWith('error') || normalized.startsWith('fail') || normalized === 'systemerror'
  )
}

function hasProviderError(payload: unknown): boolean {
  const pending = [payload]
  const seen = new WeakSet<object>()
  while (pending.length > 0) {
    const value = pending.pop()
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      continue
    }
    seen.add(value)
    if (Array.isArray(value)) {
      pending.push(...value)
      continue
    }
    for (const [key, nested] of Object.entries(value)) {
      if ((key === 'isError' || key === 'is_error') && nested === true) {
        return true
      }
      if (key === 'success' && nested === false) {
        return true
      }
      if (ERROR_VARIANT_KEYS.has(key) && isErrorVariant(nested)) {
        return true
      }
      if (ERROR_VALUE_KEYS.has(key) && nested !== null && nested !== false && nested !== '') {
        return true
      }
      pending.push(nested)
    }
  }
  return false
}

function notificationKind(kind: string): string {
  return kind.startsWith('notification:') ? kind.slice('notification:'.length) : kind
}

export function isDeltaShapedProviderFrameKind(kind: string): boolean {
  return notificationKind(kind).toLowerCase().endsWith('delta')
}

function catalogClassification(
  provider: string,
  kind: string
): ProviderFrameClassification | undefined {
  if (provider === 'claude') {
    return PROVIDER_FRAME_CLASSIFICATIONS.claude[kind as ClaudeStreamJsonFrameKind]
  }
  return undefined
}

export function classifyProviderFrame(
  provider: string,
  kind: string,
  payload: unknown
): ProviderFrameClassification {
  // Payload failure inspection outranks the name-shape heuristic below: an
  // unknown frame that reports an error must reach the user even when its
  // method name happens to look like a stream delta.
  if (hasProviderError(payload)) {
    return 'error-surface'
  }
  if (isDeltaShapedProviderFrameKind(kind)) {
    return 'stream-into-item'
  }
  if (provider === 'claude' && kind === 'message:result') {
    const subtype =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).subtype
        : undefined
    return subtype === 'success' ? 'status-chrome' : 'error-surface'
  }
  return catalogClassification(provider, kind) ?? 'timeline-substantive'
}
