import { updateViewportForClient } from './terminal-viewport-update'
import type {
  MultiplexSubscribeRequest,
  TerminalMultiplexConnection
} from './terminal-multiplex-connection'
import type { MultiplexPublishedInitialState } from './terminal-multiplex-initial-snapshot'
import type { TerminalMultiplexStream } from './terminal-stream-types'

export function activateMultiplexStream(
  state: TerminalMultiplexConnection,
  request: MultiplexSubscribeRequest,
  stream: TerminalMultiplexStream,
  published: MultiplexPublishedInitialState
): void {
  const { runtime, streams, emit } = state
  const { ptyId } = stream
  const { size } = published
  stream.unsubscribeFit = runtime.subscribeToFitOverrideChanges(ptyId, (event) => {
    const mode =
      runtime.getRemoteDesktopFitHold?.(ptyId, stream.remoteDesktopSubscriptionKey).mode ??
      'desktop-fit'
    emit({
      type: 'fit-override-changed',
      streamId: request.streamId,
      mode,
      cols: event.cols,
      rows: event.rows
    })
  })
  const fitOverride = runtime.getTerminalFitOverride(ptyId)
  const desktopHold = runtime.getRemoteDesktopFitHold?.(
    ptyId,
    stream.remoteDesktopSubscriptionKey
  ) ?? { mode: 'desktop-fit' as const, cols: size?.cols ?? 0, rows: size?.rows ?? 0 }
  emit({
    type: 'fit-override-changed',
    streamId: request.streamId,
    mode: desktopHold.mode,
    cols: fitOverride?.cols ?? desktopHold.cols,
    rows: fitOverride?.rows ?? desktopHold.rows
  })
  stream.unsubscribeResize = runtime.subscribeToTerminalResize(ptyId, (event) => {
    stream.outputBatcher.flush()
    stream.resizeGeneration += 1
    state.sendResizedFrame(stream, event)
  })
  // Install the resize listener before draining the parked viewport, since applyLayout emits synchronously.
  if (
    stream.client?.id &&
    stream.registeredRemoteDesktopDriver &&
    stream.pendingRemoteDesktopViewport
  ) {
    const viewport = stream.pendingRemoteDesktopViewport
    stream.pendingRemoteDesktopViewport = null
    void updateViewportForClient(
      runtime,
      ptyId,
      stream.remoteDesktopSubscriptionKey,
      stream.client,
      viewport,
      'register',
      !stream.supportsDesktopViewportClaims
    ).catch(() => {})
  }
  void runtime
    .waitForTerminal(request.terminal, {
      condition: 'exit',
      signal: stream.exitWaiterAbort.signal
    })
    .then((wait) => {
      if (streams.get(request.streamId) === stream) {
        state.detachStream(
          request.streamId,
          wait.satisfied && wait.condition === 'exit' && wait.status === 'exited'
            ? 'exited'
            : 'unverifiable'
        )
      }
    })
    .catch(() => {
      if (streams.get(request.streamId) === stream) {
        state.detachStream(request.streamId, 'unverifiable')
      }
    })
}
