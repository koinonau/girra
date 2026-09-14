import type { DirectSshAuthority } from '../../../shared/ssh-types'
import {
  createDirectSshPreparationCoordinator,
  type DirectSshPreparationCoordinator
} from './direct-ssh-reconnect-preparation'
import {
  combineDirectSshReconnectOutcome,
  createEmptyDirectSshRepoOutcomeCounts,
  createTerminalOnlyDirectSshReconnectOutcome
} from './direct-ssh-reconnect-coordinator-outcomes'
import {
  createDirectSshReconnectTargetState,
  type DirectSshReconnectTargetState
} from './direct-ssh-reconnect-coordinator-stabilization'
import type {
  DirectSshCorrectionReason,
  DirectSshPreparationInput,
  DirectSshPreparationOutcome,
  DirectSshPreparationReason,
  DirectSshReconnectCoordinator,
  DirectSshReconnectCoordinatorDeps,
  DirectSshReconnectOutcome,
  DirectSshReconnectTimer
} from './direct-ssh-reconnect-coordinator-types'
import {
  directSshAuthoritiesEqual,
  isDirectSshPreparationInputHostConsistent,
  normalizeDirectSshPreparationInput
} from './direct-ssh-reconnect-tokens'
export type * from './direct-ssh-reconnect-coordinator-types'
export {
  admitDirectSshSnapshotApplyToken,
  buildDirectSshSnapshotApplyToken
} from './direct-ssh-reconnect-tokens'

export const DIRECT_SSH_RELAY_STABILIZATION_MS = 5_000

export function createDirectSshReconnectCoordinator(
  deps: DirectSshReconnectCoordinatorDeps
): DirectSshReconnectCoordinator {
  const now = deps.now ?? Date.now
  const setTimer =
    deps.setTimer ?? ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs))
  const clearTimer =
    deps.clearTimer ??
    ((timer: DirectSshReconnectTimer) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const stabilizationMs = deps.stabilizationMs ?? DIRECT_SSH_RELAY_STABILIZATION_MS
  const targets = new Map<string, DirectSshReconnectTargetState>()
  let stopped = false

  const isCurrent = (authority: DirectSshAuthority): boolean => {
    const state = targets.get(authority.targetId)
    return (
      !stopped &&
      directSshAuthoritiesEqual(state?.authority, authority) &&
      deps.isCurrentConnectedAuthority(authority)
    )
  }

  const preparation: DirectSshPreparationCoordinator = createDirectSshPreparationCoordinator({
    scheduler: deps.scheduler,
    isCurrentAuthority: isCurrent,
    readLineage: deps.readHostScopedLineage
  })

  const replaceAuthority = (authority: DirectSshAuthority): void => {
    if (stopped) {
      return
    }
    const previous = targets.get(authority.targetId)
    if (directSshAuthoritiesEqual(previous?.authority, authority)) {
      return
    }
    if (previous) {
      if (previous.timer) {
        clearTimer(previous.timer)
      }
      preparation.invalidateAuthority(previous.authority)
      deps.scheduler.disposeProvider(previous.authority)
    }
    const installedAt = now()
    targets.set(
      authority.targetId,
      createDirectSshReconnectTargetState(authority, previous, installedAt, stabilizationMs)
    )
  }

  const captureInput = async (
    authority: DirectSshAuthority,
    reason: DirectSshPreparationReason
  ): Promise<DirectSshPreparationInput | null> => {
    const captured = await deps.capturePreparationInput(authority, reason)
    if (
      !captured ||
      !directSshAuthoritiesEqual(captured, authority) ||
      !isDirectSshPreparationInputHostConsistent(captured) ||
      !isCurrent(authority)
    ) {
      return null
    }
    return normalizeDirectSshPreparationInput({ ...captured, reason })
  }

  const startSync = (token: NonNullable<DirectSshPreparationOutcome['token']>): void => {
    try {
      void Promise.resolve(deps.syncRemoteWorkspaceAfterConnect(token)).catch(() => {})
    } catch {
      // Sync failure is reported by its owning boundary.
    }
  }

  const runPreparedReconnect = async (
    authority: DirectSshAuthority,
    staleBindingsCleared: number,
    retriedTerminals: number
  ): Promise<DirectSshReconnectOutcome> => {
    const input = await captureInput(authority, 'reconnect')
    if (!input) {
      return createTerminalOnlyDirectSshReconnectOutcome(
        'stale',
        staleBindingsCleared,
        retriedTerminals
      )
    }
    const prepared = await preparation.acquire(input)
    let correctedTerminals = 0
    if (prepared.token && isCurrent(authority)) {
      correctedTerminals = deps.correctUnboundTerminalPanes(authority, 'preparation-complete')
      if (isCurrent(authority)) {
        startSync(prepared.token)
      }
    }
    return combineDirectSshReconnectOutcome(
      prepared,
      staleBindingsCleared,
      retriedTerminals,
      correctedTerminals
    )
  }

  const runDelayedPreparation = async (authority: DirectSshAuthority): Promise<void> => {
    if (!isCurrent(authority)) {
      return
    }
    await runPreparedReconnect(authority, 0, 0)
  }

  const scheduleLatestPreparation = (state: DirectSshReconnectTargetState): void => {
    if (state.timer || state.dampUntil === null) {
      return
    }
    const delayMs = Math.max(0, state.dampUntil - now())
    state.timer = setTimer(() => {
      state.timer = null
      state.dampUntil = null
      void runDelayedPreparation(state.authority)
    }, delayMs)
  }

  const requestReconnect = async (
    authority: DirectSshAuthority
  ): Promise<DirectSshReconnectOutcome> => {
    if (stopped || !deps.isCurrentConnectedAuthority(authority)) {
      return createTerminalOnlyDirectSshReconnectOutcome(stopped ? 'stopped' : 'stale')
    }
    replaceAuthority(authority)
    if (!isCurrent(authority)) {
      return createTerminalOnlyDirectSshReconnectOutcome('stale')
    }
    const staleBindingsCleared = deps.invalidateStaleTerminalBindings(authority)
    const retriedTerminals = deps.retryTargetPanes(authority)
    const state = targets.get(authority.targetId)!
    if (state.dampUntil !== null && now() < state.dampUntil) {
      scheduleLatestPreparation(state)
      return createTerminalOnlyDirectSshReconnectOutcome(
        'stabilizing',
        staleBindingsCleared,
        retriedTerminals
      )
    }
    return runPreparedReconnect(authority, staleBindingsCleared, retriedTerminals)
  }

  const prepareOnly = (
    rawInput: DirectSshPreparationInput
  ): Promise<DirectSshPreparationOutcome> => {
    const input = normalizeDirectSshPreparationInput(rawInput)
    if (stopped || !isCurrent(input) || !isDirectSshPreparationInputHostConsistent(input)) {
      return Promise.resolve({
        status: stopped ? 'stopped' : 'stale',
        token: null,
        repoOutcomes: createEmptyDirectSshRepoOutcomeCounts(),
        lineageOutcome: 'not-started'
      })
    }
    return preparation.acquire(input)
  }

  const finalizeHydratedTerminals = (authority: DirectSshAuthority): number =>
    isCurrent(authority) ? deps.finalizeHydratedTerminalPanes(authority) : 0

  const correctUnboundTerminals = (
    authority: DirectSshAuthority,
    reason: DirectSshCorrectionReason
  ): number => (isCurrent(authority) ? deps.correctUnboundTerminalPanes(authority, reason) : 0)

  const invalidate = (targetId: string): void => {
    const state = targets.get(targetId)
    if (state?.timer) {
      clearTimer(state.timer)
    }
    preparation.invalidateTarget(targetId)
    deps.scheduler.invalidateTarget(targetId)
    targets.delete(targetId)
  }

  const stop = (): void => {
    if (stopped) {
      return
    }
    stopped = true
    for (const state of targets.values()) {
      if (state.timer) {
        clearTimer(state.timer)
      }
    }
    preparation.stop()
    deps.scheduler.stop()
    targets.clear()
  }

  return {
    requestReconnect,
    prepareOnly,
    finalizeHydratedTerminals,
    correctUnboundTerminals,
    replaceAuthority,
    invalidate,
    stop
  }
}
