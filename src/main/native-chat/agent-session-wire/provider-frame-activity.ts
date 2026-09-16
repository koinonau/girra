type ActivityText = string | null | undefined

function stringField(source: unknown, key: string): string | null {
  const value =
    typeof source === 'object' && source !== null && !Array.isArray(source)
      ? (source as Record<string, unknown>)[key]
      : undefined
  return typeof value === 'string' && value.trim() ? value : null
}

/**
 * Claude does not narrate its own turn, so the activity line stays the generic fallback.
 *
 * Claude's only turn-wide frame is `system/status`, whose payload is a bare token: every
 * sentence Girra ever put on this line for it was Girra's own wording for `requesting`, which is
 * true for nearly the whole turn and says no more than the fallback does. Its `task_*` frames do
 * carry prose, but they are keyed by task id and subagent type: they describe a spawned task, not
 * this turn, and the background-tasks strip already owns that. Compaction is the one exception
 * kept: a real, rare state that explains an otherwise unexplained wait.
 */
export function claudeProviderFrameActivity(kind: string, payload: unknown): ActivityText {
  if (kind === 'message:system:status') {
    return stringField(payload, 'status') === 'compacting' ? 'Compacting the conversation' : null
  }
  if (
    kind === 'message:system:task_started' ||
    kind === 'message:system:task_progress' ||
    kind === 'message:system:task_updated' ||
    kind === 'message:system:control_request_progress' ||
    kind === 'message:tool_progress'
  ) {
    return null
  }
  return undefined
}
