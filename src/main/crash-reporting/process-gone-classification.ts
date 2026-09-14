export type ExpectedTeardownScope = 'none' | 'renderer-reload' | 'app-shutdown'

const NON_RECOVERABLE_RENDERER_REASONS = new Set(['integrity-failure'])

export function shouldRecoverRendererAfterProcessGone({
  reason,
  expectedTeardown
}: {
  reason: string
  expectedTeardown: ExpectedTeardownScope
}): boolean {
  if (expectedTeardown === 'app-shutdown') {
    return false
  }
  // Why: an integrity failure means Chromium cannot trust the renderer, so a
  // reload cannot safely recover it. Launch failures can be transient and are
  // bounded by the caller's renderer-recovery circuit breaker.
  if (NON_RECOVERABLE_RENDERER_REASONS.has(reason)) {
    return false
  }
  return !(reason === 'killed' && expectedTeardown === 'renderer-reload')
}
