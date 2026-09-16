import type { NativeChatMessage } from '../../../../shared/native-chat-types'
import {
  readNativeChatTranscriptTail,
  subscribeNativeChatTranscript,
  type NativeChatTranscriptSubscription,
  type SubscribeNativeChatTranscriptArgs
} from '../../../native-chat/transcript-watch'
import { defineMethod, defineStreamingMethod } from '../core'
import { sanitizeNativeChatRpcImageBlock } from './native-chat-rpc-image-block'
import {
  MOBILE_NATIVE_CHAT_MAX_WINDOW,
  NativeChatSession,
  NativeChatUnsubscribe
} from '../../../../shared/rpc-contract/native-chat-params'

// Why: a long agent session can hold thousands of turns (with full tool I/O).
// Shipping all of them over the paired connection and rendering them at once
// freezes the client, so the runtime RPC windows to the most recent slice —
// the conversation tail is what the chat view shows first. The desktop IPC path
// is unaffected (it reads locally with a virtualized list).
// Small first page for a fast initial paint; the client raises `limit` to load
// older history as the user scrolls back.
const MOBILE_NATIVE_CHAT_DEFAULT_WINDOW = 40

function sanitizeMessage(message: NativeChatMessage): NativeChatMessage {
  return {
    ...message,
    blocks: message.blocks.map((block) =>
      block.type === 'image-ref' ? sanitizeNativeChatRpcImageBlock(block) : block
    )
  }
}

function sanitizeAppendForClient(messages: readonly NativeChatMessage[]): NativeChatMessage[] {
  return messages.map((message) => sanitizeMessage(message))
}

/** Window a transcript to its most recent `limit` messages so a long session
 *  can't freeze the client. Windowing by count applies to ALL RPC clients —
 *  shipping thousands of turns over the paired link is bad for every one. */
function windowTranscript(
  messages: readonly NativeChatMessage[],
  limit = MOBILE_NATIVE_CHAT_DEFAULT_WINDOW
): NativeChatMessage[] {
  const window = Math.min(Math.max(limit, 1), MOBILE_NATIVE_CHAT_MAX_WINDOW)
  return messages.length > window ? messages.slice(-window) : messages.slice()
}

/** Apply the windowed slice and keep inline image bytes off every RPC transport. */
function windowForClient(
  messages: readonly NativeChatMessage[],
  limit = MOBILE_NATIVE_CHAT_DEFAULT_WINDOW
): NativeChatMessage[] {
  const windowed = windowTranscript(messages, limit)
  return windowed.map((message) => sanitizeMessage(message))
}

export const NATIVE_CHAT_METHODS = [
  defineMethod({
    name: 'nativeChat.readSession',
    params: NativeChatSession,
    handler: async (params, { signal }) => {
      const limit = params.limit ?? MOBILE_NATIVE_CHAT_DEFAULT_WINDOW
      const result = await readNativeChatTranscriptTail(
        {
          agent: params.agent,
          sessionId: params.sessionId,
          transcriptPath: params.transcriptPath,
          limit,
          beforeOffset: params.beforeOffset
        },
        signal
      )
      return 'messages' in result
        ? {
            messages: windowForClient(result.messages, limit),
            hasMore: result.hasMore,
            beforeOffset: result.beforeOffset,
            ...(result.lifecycle ? { lifecycle: result.lifecycle } : {})
          }
        : result
    }
  }),
  defineStreamingMethod({
    name: 'nativeChat.subscribe',
    params: NativeChatSession,
    handler: async (params, { runtime, connectionId, signal }, emit) => {
      if (signal?.aborted) {
        return
      }
      let closed = false
      let unsubscribe = (): void => {}
      const setupController = new AbortController()
      // Why: the first drain is a bounded tail snapshot; later drains emit only
      // appended turns. This avoids parsing or shipping full long transcripts.
      // Clients merge by message id, so the initial windowed batch doubles as the
      // snapshot. Keyed by the client-supplied subscriptionId when present so
      // registration and unsubscribe derive from the same token; otherwise by
      // agent:sessionId, which is exactly the token existing mobile clients send to
      // unsubscribe (no wire break).
      const cleanupToken = params.subscriptionId ?? `${params.agent}:${params.sessionId}`
      const subscriptionId = `nativeChat:${connectionId ?? 'local'}:${cleanupToken}`
      const limit = params.limit ?? MOBILE_NATIVE_CHAT_DEFAULT_WINDOW
      const cleanup = (): void => {
        if (closed) {
          return
        }
        closed = true
        signal?.removeEventListener('abort', handleAbort)
        setupController.abort()
        unsubscribe()
        emit({ type: 'end' })
      }
      function handleAbort(): void {
        runtime.cleanupSubscription(subscriptionId)
      }
      signal?.addEventListener('abort', handleAbort, { once: true })
      runtime.registerSubscriptionCleanup(subscriptionId, cleanup, connectionId)
      if (signal?.aborted) {
        runtime.cleanupSubscription(subscriptionId)
        return
      }
      if (closed) {
        return
      }
      const subscribeArgs: SubscribeNativeChatTranscriptArgs = {
        agent: params.agent,
        sessionId: params.sessionId,
        transcriptPath: params.transcriptPath,
        initialLimit: limit,
        onInitialSnapshot: (messages, hasMore, beforeOffset, error, lifecycle) => {
          if (closed) {
            return
          }
          // Forward an initial-drain error so a watching client's first frame carries it
          // instead of stranding the view at 'loading' when the read keeps throwing.
          emit({
            type: 'snapshot',
            messages: windowForClient(messages, limit),
            hasMore,
            beforeOffset,
            ...(error ? { error } : {}),
            ...(lifecycle ? { lifecycle } : {})
          })
        },
        ...(params.capabilities?.transcriptPending === 1
          ? {
              onTranscriptPending: () => {
                if (!closed) {
                  emit({ type: 'snapshot', messages: [], hasMore: false, pending: true })
                }
              }
            }
          : {}),
        onReplace: (messages, hasMore, beforeOffset, lifecycle) => {
          if (closed) {
            return
          }
          emit({
            type: 'replacement',
            messages: windowForClient(messages, limit),
            hasMore,
            beforeOffset,
            ...(lifecycle ? { lifecycle } : {})
          })
        },
        onAppend: (messages, lifecycle) => {
          if (closed) {
            return
          }
          emit({
            type: 'appended',
            messages: sanitizeAppendForClient(messages),
            ...(lifecycle ? { lifecycle } : {})
          })
        }
      }
      let subscription: NativeChatTranscriptSubscription
      try {
        subscription = await subscribeNativeChatTranscript(subscribeArgs, setupController.signal)
      } catch (error) {
        if (closed || setupController.signal.aborted) {
          return
        }
        throw error
      }
      // The connection may have closed while the file was being resolved.
      if (closed) {
        subscription.unsubscribe()
        return
      }
      if (!subscription.watching) {
        emit({
          type: 'snapshot',
          messages: [],
          hasMore: false,
          error: 'Transcript unavailable'
        })
      }
      unsubscribe = subscription.unsubscribe
    }
  }),
  defineMethod({
    name: 'nativeChat.unsubscribe',
    params: NativeChatUnsubscribe,
    handler: async (params, { runtime, connectionId }) => {
      const connection = connectionId ?? 'local'
      if (params.subscriptionId) {
        runtime.cleanupSubscription(`nativeChat:${connection}:${params.subscriptionId}`)
        return { unsubscribed: true }
      }
      runtime.cleanupSubscriptionsByPrefix(`nativeChat:${connection}:`)
      return { unsubscribed: true }
    }
  })
]
