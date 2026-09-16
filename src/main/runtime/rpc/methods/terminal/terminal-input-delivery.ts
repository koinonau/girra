import { isAgentSessionPtyWriteRefusedError } from '../../../../../shared/agent-session-pty-write-admission'
import { InvalidArgumentError } from '../../core'
import type { OrcaRuntimeService, SubscriptionRegistration } from '../../../orca-runtime'
import {
  TERMINAL_INPUT_MAX_BYTES,
  TERMINAL_INPUT_TOO_LARGE_ERROR,
  isTerminalInputTooLargeWithYield
} from '../../../../../shared/terminal-input'

export async function assertTerminalSendTextWithinLimit(text: string | undefined): Promise<void> {
  if (!text) {
    return
  }
  // Why: sends can be paste-sized; validate outside Zod so large input yields before runtime dispatch.
  if (await isTerminalInputTooLargeWithYield(text, TERMINAL_INPUT_MAX_BYTES)) {
    throw new InvalidArgumentError(TERMINAL_INPUT_TOO_LARGE_ERROR)
  }
}

export type TerminalStreamInputOutcome = 'delivered' | 'rejected' | 'failed'

export function watchSubscriptionLifetime(
  runtime: OrcaRuntimeService,
  ptyId: string,
  signal: AbortSignal | undefined,
  registration: SubscriptionRegistration
): () => void {
  let unsubscribeExit: (() => void) | null = null
  let removeAbort: (() => void) | null = null
  let stopped = false
  const stop = (): void => {
    stopped = true
    unsubscribeExit?.()
    removeAbort?.()
  }
  const release = (): void => {
    registration.releaseIfCurrent()
    stop()
  }
  unsubscribeExit = runtime.subscribeToPtyExit(ptyId, release)
  if (stopped) {
    unsubscribeExit()
    return stop
  }
  if (!signal) {
    return stop
  }
  if (signal.aborted) {
    release()
    return stop
  }
  const onAbort = (): void => release()
  removeAbort = () => signal.removeEventListener('abort', onAbort)
  signal.addEventListener('abort', onAbort, { once: true })
  if (stopped) {
    removeAbort()
  }
  return stop
}

export function isTerminalStreamInputRejection(error: unknown): boolean {
  // Why: a lease refusal is a deliberate rejection, not a transport failure, so the stream reports
  // it through the WriteUnavailable frame old clients already decode rather than a new opcode.
  if (isAgentSessionPtyWriteRefusedError(error)) {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('terminal_not_writable') || message.includes('terminal_handle_stale')
}

export async function sendTerminalStreamInput(
  runtime: OrcaRuntimeService,
  terminal: string,
  text: string
): Promise<TerminalStreamInputOutcome> {
  try {
    const result = await runtime.sendTerminal(terminal, { text, enter: false, interrupt: false })
    return result.accepted ? 'delivered' : 'rejected'
  } catch (error) {
    return isTerminalStreamInputRejection(error) ? 'rejected' : 'failed'
  }
}

export function getTerminalSendGuardRefusedReason(
  error: unknown
): 'no-agent' | 'permission' | undefined {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('terminal_guard_permission')) {
    return 'permission'
  }
  if (message.includes('terminal_guard_no_agent')) {
    return 'no-agent'
  }
  return undefined
}

export function isTerminalSendGuardNotWritable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('terminal_guard_not_writable')
}

export function assertTerminalSendExactPtyBinding(
  runtime: OrcaRuntimeService,
  handle: string,
  expectedPtyId: string | undefined
): void {
  try {
    if (expectedPtyId && runtime.resolveLiveLeafForHandle(handle)?.ptyId === expectedPtyId) {
      return
    }
  } catch {
    // Fall through to the stable guarded-send result below.
  }
  throw new Error('terminal_guard_not_writable')
}
