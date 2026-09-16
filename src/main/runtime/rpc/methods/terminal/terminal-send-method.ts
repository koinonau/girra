import { isAgentSessionPtyWriteRefusedError } from '../../../../../shared/agent-session-pty-write-admission'
import { assertLegacyAiVaultResumeCommandAllowed } from '../../../../ai-vault/structured-session-ownership'
import { defineMethod } from '../../core'
import { assertTerminalAgentSendable } from '../../terminal-agent-send-guard'
import { TerminalSend } from './unary-schemas'
import {
  assertTerminalSendExactPtyBinding,
  assertTerminalSendTextWithinLimit,
  getTerminalSendGuardRefusedReason,
  isTerminalSendGuardNotWritable
} from './terminal-input-delivery'
import { updateViewportForClient } from './terminal-viewport-update'
import {
  ensureUnsupportedTerminalPromptReceipt,
  observeReplayedTerminalPrompt
} from './terminal-prompt-receipt'

export const TERMINAL_SEND_METHODS = [
  defineMethod({
    name: 'terminal.send',
    params: TerminalSend,
    handler: async (
      params,
      {
        runtime,
        signal,
        orchestrationMutation,
        recordMutationReceipt,
        markMutationEffectPossible,
        replayedMutationReceipt
      }
    ) => {
      await assertTerminalSendTextWithinLimit(params.text)
      if (params.text) {
        await assertLegacyAiVaultResumeCommandAllowed(params.text, () =>
          runtime.ensureStructuredAgentSessionHost()
        )
      }
      const replayObservation = await observeReplayedTerminalPrompt(
        runtime,
        params.terminal,
        replayedMutationReceipt,
        params.waitSubmitMs,
        signal
      )
      if (replayObservation) {
        return replayObservation
      }
      // Why: a stale handle must fail with terminal_handle_stale, not write viewport state to the wrong PTY (#7718).
      const leaf = runtime.resolveLiveLeafForHandle(params.terminal)
      if (
        leaf?.ptyId &&
        params.client?.type === 'desktop' &&
        params.claimViewport === true &&
        params.viewport
      ) {
        const claim = await updateViewportForClient(
          runtime,
          leaf.ptyId,
          `send:${params.client.id}`,
          params.client,
          params.viewport,
          'refresh',
          true
        )
        // Why: a stream-less request can't safely create ownership, so never write at stale geometry.
        if (!claim.updated) {
          return {
            send: {
              handle: params.terminal,
              accepted: false,
              bytesWritten: 0
            }
          }
        }
      }
      const hasText = typeof params.text === 'string' && params.text.length > 0
      const hasSuffix = params.enter === true || params.interrupt === true
      if (params.requireAgentStatus === 'sendable' && hasText && hasSuffix) {
        // Why: guarded sends are two-phase; reject combined payload + submit so a guard flip can't cause partial delivery.
        return {
          send: {
            handle: params.terminal,
            accepted: false,
            bytesWritten: 0
          }
        }
      }
      // Why: recheck permission/no-agent state immediately before accepting the PTY write.
      const assertSendPreconditions =
        params.requireAgentStatus === 'sendable'
          ? async (ptyId?: string): Promise<void> => {
              await assertTerminalAgentSendable({
                runtime,
                handle: params.terminal,
                assertWritable: () =>
                  assertTerminalSendExactPtyBinding(runtime, params.terminal, ptyId)
              })
            }
          : undefined
      if (params.requireAgentStatus === 'sendable') {
        try {
          await assertSendPreconditions?.(leaf?.ptyId ?? undefined)
        } catch (error) {
          if (isTerminalSendGuardNotWritable(error)) {
            return {
              send: {
                handle: params.terminal,
                accepted: false,
                bytesWritten: 0
              }
            }
          }
          const refusedReason = getTerminalSendGuardRefusedReason(error)
          if (!refusedReason) {
            throw error
          }
          return {
            send: {
              handle: params.terminal,
              accepted: false,
              bytesWritten: 0,
              refusedReason
            }
          }
        }
      }
      const beforeWrite =
        orchestrationMutation && params.agentPrompt === true
          ? async (ptyId?: string): Promise<void> => {
              await assertSendPreconditions?.(ptyId)
              markMutationEffectPossible?.()
            }
          : assertSendPreconditions
      const useSettledAgentPrompt =
        params.agentPrompt === true &&
        hasText &&
        params.enter === true &&
        params.interrupt !== true &&
        params.client?.type === 'desktop' &&
        (await runtime.isTerminalRunningSettledPromptAgent(params.terminal))
      let result
      let acceptedPromptCheckpoint: unknown
      try {
        result = useSettledAgentPrompt
          ? await runtime.sendTerminalAgentPrompt(params.terminal, params.text!, {
              beforeWrite,
              signal,
              ...(orchestrationMutation
                ? {
                    acceptQueued: true,
                    observationTimeoutMs: params.waitSubmitMs ?? 0,
                    requestId: orchestrationMutation.requestId,
                    onInputAccepted: (send) => {
                      acceptedPromptCheckpoint = { send }
                      recordMutationReceipt?.(acceptedPromptCheckpoint)
                    }
                  }
                : {})
            })
          : await runtime.sendTerminal(
              params.terminal,
              {
                text: params.text,
                enter: params.enter === true,
                interrupt: params.interrupt === true
              },
              { beforeWrite, signal }
            )
      } catch (error) {
        if (isAgentSessionPtyWriteRefusedError(error)) {
          // Why: name the owner and the stage instead of a bare not-writable, so a client can say
          // who holds the session rather than retrying into a lease it will never win.
          return {
            send: {
              handle: params.terminal,
              accepted: false,
              bytesWritten: 0,
              agentSessionRefusal: error.refusal
            }
          }
        }
        if (acceptedPromptCheckpoint) {
          return acceptedPromptCheckpoint
        }
        const refusedReason = getTerminalSendGuardRefusedReason(error)
        if (refusedReason) {
          return {
            send: {
              handle: params.terminal,
              accepted: false,
              bytesWritten: 0,
              refusedReason
            }
          }
        }
        if (isTerminalSendGuardNotWritable(error)) {
          return {
            send: {
              handle: params.terminal,
              accepted: false,
              bytesWritten: 0
            }
          }
        }
        throw error
      }
      if (orchestrationMutation && params.agentPrompt === true && !result.prompt) {
        result = ensureUnsupportedTerminalPromptReceipt(
          runtime,
          params.terminal,
          orchestrationMutation.requestId,
          result
        )
      }
      return { send: result }
    }
  })
]
