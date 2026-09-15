import type { ClaudeRuntimeAuthService } from './claude-accounts/runtime-auth-service'
import type { Store } from './persistence'

const AUTH_PRESERVATION_TIMEOUT_MS = 2_000

type ClaudeRuntimeAuthSync = Pick<ClaudeRuntimeAuthService, 'syncForCurrentSelection'>
type ShutdownStore = Pick<Store, 'flushPendingOrThrowAsync'>

type AuthPreservationStep = 'Claude auth preservation' | 'Store persistence'

export type AgentAuthRestartPreservationOptions = {
  claudeRuntimeAuth?: ClaudeRuntimeAuthSync | null
  store?: ShutdownStore | null
}

export async function preserveAgentAuthBeforeRestart({
  claudeRuntimeAuth,
  store
}: AgentAuthRestartPreservationOptions): Promise<void> {
  const startedAt = Date.now()
  if (claudeRuntimeAuth) {
    await runWithinLifecycleTimeout(
      'Claude auth preservation',
      () => claudeRuntimeAuth.syncForCurrentSelection(),
      AUTH_PRESERVATION_TIMEOUT_MS
    )
  }
  if (store) {
    await runWithinLifecycleTimeout(
      'Store persistence',
      () => store.flushPendingOrThrowAsync(),
      remainingLifecycleTime(startedAt)
    )
  }
}

function remainingLifecycleTime(startedAt: number): number {
  return Math.max(0, AUTH_PRESERVATION_TIMEOUT_MS - (Date.now() - startedAt))
}

async function runWithinLifecycleTimeout(
  step: AuthPreservationStep,
  run: () => Promise<void>,
  timeoutMs: number
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const operation = Promise.resolve()
    .then(run)
    .catch((error) => {
      logStepFailure(step, error)
    })

  // Why: this timeout only releases the restart/update path. It does not
  // cancel a sync that already started.
  const timeoutResult = new Promise<'timeout'>((resolve) => {
    timeout = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  const result = await Promise.race([operation.then(() => 'done' as const), timeoutResult])
  if (result === 'timeout') {
    logStepTimeout(step, timeoutMs)
    return
  }

  if (timeout) {
    clearTimeout(timeout)
  }
}

function logStepFailure(step: AuthPreservationStep, error: unknown): void {
  console.warn(
    `[agent-auth-restart] ${step} failed (${describeErrorKind(error)}); continuing restart/update`
  )
}

function logStepTimeout(step: AuthPreservationStep, timeoutMs: number): void {
  console.warn(`[agent-auth-restart] ${step} exceeded ${timeoutMs}ms; continuing restart/update`)
}

function describeErrorKind(error: unknown): string {
  if (error instanceof Error) {
    return error.name || 'Error'
  }
  return typeof error
}
