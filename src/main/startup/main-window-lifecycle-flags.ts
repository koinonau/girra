import { resolveExpectedTeardownScope } from '../crash-reporting/expected-teardown-state'
import type { ExpectedTeardownScope } from '../crash-reporting/process-gone-classification'
import { mainProcessState as state } from './main-process-state'

export function markExpectedRendererReload(webContentsId: number, durationMs = 10_000): void {
  state.expectedRendererReload.mark(webContentsId, durationMs)
}

export function clearExpectedRendererReload(webContentsId?: number): void {
  state.expectedRendererReload.clear(webContentsId)
}

export function getExpectedTeardownScope(webContentsId?: number): ExpectedTeardownScope {
  return resolveExpectedTeardownScope({
    isQuitting: state.isQuitting,
    isExpectedRendererReload:
      webContentsId !== undefined && state.expectedRendererReload.matches(webContentsId)
  })
}

export function markRecoveryReloadInFlight(webContentsId: number, durationMs = 10_000): void {
  state.recoveryReloadInFlight.mark(webContentsId, durationMs)
}

export function isRecoveryReloadInFlight(webContentsId: number): boolean {
  // Why: consume on read — the recovery reload fires exactly one did-finish-load, so a later genuine reload still sweeps orphaned PTYs.
  return state.recoveryReloadInFlight.matches(webContentsId, { consume: true })
}
