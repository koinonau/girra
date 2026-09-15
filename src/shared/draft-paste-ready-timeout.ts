const DEFAULT_DRAFT_PASTE_READY_TIMEOUT_MS = 8000

export function resolveDraftPasteReadyTimeoutMs(overrideMs?: number): number {
  return overrideMs ?? DEFAULT_DRAFT_PASTE_READY_TIMEOUT_MS
}
