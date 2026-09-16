import type { ChildProcess } from 'node:child_process'
import {
  QUIT_RENDERER_ACK_TIMEOUT_MS,
  WILL_QUIT_TEARDOWN_DEADLINE_MS
} from '../../shared/quit-teardown-deadline'
import { RuntimeClientError } from './types'

export const MAC_CRASH_REPORT_GLOB = '~/Library/Logs/DiagnosticReports/Orca-*.ips'

export function serveSignalExitError(
  signal: NodeJS.Signals | null,
  platform: NodeJS.Platform = process.platform
): RuntimeClientError {
  if (!signal) {
    return new RuntimeClientError(
      'runtime_serve_failed',
      'Girra serve exited without reporting an exit code or signal.'
    )
  }
  if (platform !== 'darwin' || signal !== 'SIGABRT') {
    return new RuntimeClientError('runtime_serve_failed', `Girra serve exited via ${signal}.`)
  }
  // Why: the startup abort happens inside +[NSApplication sharedApplication], before any of our JS
  // runs, so the parent CLI is the only place it can be explained. We only see the signal, never the
  // phase, so the cause is offered as the likely one rather than asserted.
  return new RuntimeClientError(
    'runtime_serve_failed',
    'Girra serve aborted with SIGABRT on macOS. This most often happens at application startup, when the process cannot register with the macOS window server, which is common in restricted or sandboxed environments, SSH sessions without a GUI login, and CI.',
    {
      nextSteps: [
        'Re-run `orca serve` outside a sandboxed or restricted environment, with a macOS desktop login active.',
        `Look for a crash report at ${MAC_CRASH_REPORT_GLOB}.`
      ]
    }
  )
}

export const SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS = 5_000
export const SERVE_CHILD_FORCE_KILL_GRACE_MS =
  QUIT_RENDERER_ACK_TIMEOUT_MS +
  WILL_QUIT_TEARDOWN_DEADLINE_MS +
  SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS

/** Forwards termination signals to the serve child and resolves with its exit code. */
export function superviseForegroundServe(child: ChildProcess): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const forwardsHangup = process.platform === 'linux'
    const forwardedSignals = new Set<NodeJS.Signals>()
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null
    const forwardSignal = (signal: NodeJS.Signals): void => {
      // A Windows console delivers Ctrl-C to parent and child; child.kill would terminate the child mid-teardown.
      if (process.platform !== 'win32') {
        forwardedSignals.add(signal)
        child.kill(signal)
      }
      forceKillTimer ??= setTimeout(() => child.kill('SIGKILL'), SERVE_CHILD_FORCE_KILL_GRACE_MS)
    }
    const cleanup = (): void => {
      process.off('SIGINT', forwardSignal)
      process.off('SIGTERM', forwardSignal)
      if (forwardsHangup) {
        process.off('SIGHUP', forwardSignal)
      }
      if (forceKillTimer) {
        clearTimeout(forceKillTimer)
      }
    }
    process.on('SIGINT', forwardSignal)
    process.on('SIGTERM', forwardSignal)
    if (forwardsHangup) {
      process.on('SIGHUP', forwardSignal)
    }
    const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup()
      if (typeof code === 'number' || (signal !== null && forwardedSignals.has(signal))) {
        resolveExit(code ?? 0)
        return
      }
      reject(serveSignalExitError(signal))
    }
    child.once('error', (error) => {
      cleanup()
      child.off('exit', handleExit)
      reject(error)
    })
    child.once('exit', handleExit)
  })
}
