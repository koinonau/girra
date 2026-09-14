import type { DirectSshAuthority } from '../../../shared/ssh-types'
import type {
  DirectSshWorktreeRefreshLease,
  DirectSshWorktreeRefreshOutcome,
  DirectSshWorktreeRefreshScheduler,
  DirectSshWorktreeRefreshTerminalStatus
} from './direct-ssh-worktree-refresh-scheduler'
import type {
  DirectSshLineageOutcome,
  DirectSshPreparationInput,
  DirectSshPreparationOutcome,
  DirectSshPreparationToken,
  DirectSshRepoOutcomeCounts
} from './direct-ssh-reconnect-coordinator-types'
import { createEmptyDirectSshRepoOutcomeCounts } from './direct-ssh-reconnect-coordinator-outcomes'
import {
  directSshAuthoritiesEqual,
  directSshPreparationOperationKey,
  directSshRepoFingerprint,
  normalizeDirectSshPreparationInput
} from './direct-ssh-reconnect-tokens'

type PreparationOperation = {
  key: string
  input: DirectSshPreparationInput
  leases: DirectSshWorktreeRefreshLease[]
  invalidatedAs: 'stale' | 'stopped' | null
  settleInvalidation: (reason: 'stale' | 'stopped') => void
  invalidation: Promise<'stale' | 'stopped'>
  promise: Promise<DirectSshPreparationOutcome>
}

export type DirectSshPreparationCoordinator = {
  acquire: (input: DirectSshPreparationInput) => Promise<DirectSshPreparationOutcome>
  invalidateAuthority: (authority: DirectSshAuthority) => void
  invalidateTarget: (targetId: string) => void
  stop: () => void
}

type PreparationCoordinatorDeps = {
  scheduler: DirectSshWorktreeRefreshScheduler
  isCurrentAuthority: (authority: DirectSshAuthority) => boolean
  readLineage: (input: DirectSshPreparationInput) => Promise<DirectSshLineageOutcome>
}

const TERMINAL_STATUSES: readonly DirectSshWorktreeRefreshTerminalStatus[] = [
  'complete',
  'non-authoritative',
  'timed-out',
  'cancel-budget-exhausted',
  'canceled',
  'stale',
  'rejected'
]

function countRepoOutcomes(
  outcomes: readonly DirectSshWorktreeRefreshOutcome[]
): DirectSshRepoOutcomeCounts {
  const counts = createEmptyDirectSshRepoOutcomeCounts()
  for (const outcome of outcomes) {
    counts[outcome.status]++
  }
  return counts
}

function awaitRepoLeases(
  leases: readonly DirectSshWorktreeRefreshLease[]
): Promise<DirectSshWorktreeRefreshOutcome[]> {
  if (leases.length === 0) {
    return Promise.resolve([])
  }
  return new Promise((resolve) => {
    const outcomes: DirectSshWorktreeRefreshOutcome[] = []
    let remaining = leases.length
    leases.forEach((lease, index) => {
      void lease.result.then(
        (outcome) => {
          outcomes[index] = outcome
          remaining--
          if (remaining === 0) {
            resolve(outcomes)
          }
        },
        () => {
          outcomes[index] = { status: 'rejected' }
          remaining--
          if (remaining === 0) {
            resolve(outcomes)
          }
        }
      )
    })
  })
}

function terminalPreparationOutcome(
  status: 'canceled' | 'stale' | 'stopped',
  repoOutcomes: DirectSshRepoOutcomeCounts
): DirectSshPreparationOutcome {
  return {
    status,
    token: null,
    repoOutcomes,
    lineageOutcome: 'not-started'
  }
}

function buildPreparationToken(
  input: DirectSshPreparationInput,
  outcome: 'complete' | 'degraded'
): DirectSshPreparationToken {
  return {
    authority: {
      targetId: input.targetId,
      providerEpoch: input.providerEpoch,
      connectionGeneration: input.connectionGeneration
    },
    catalogRevision: input.catalogRevision,
    repoFingerprint: directSshRepoFingerprint(input),
    authorityRequirement: input.authorityRequirement,
    snapshotRevision: input.snapshotRevision ?? null,
    outcome
  }
}

function hasOutcome(
  counts: DirectSshRepoOutcomeCounts,
  statuses: readonly DirectSshWorktreeRefreshTerminalStatus[]
): boolean {
  return statuses.some((status) => counts[status] > 0)
}

export function createDirectSshPreparationCoordinator(
  deps: PreparationCoordinatorDeps
): DirectSshPreparationCoordinator {
  const operations = new Map<string, PreparationOperation>()
  let stopped = false

  const run = async (operation: PreparationOperation): Promise<DirectSshPreparationOutcome> => {
    const { input } = operation
    operation.leases = input.repoRefs.map((repo) =>
      deps.scheduler.request({
        targetId: input.targetId,
        providerEpoch: input.providerEpoch,
        connectionGeneration: input.connectionGeneration,
        repoId: repo.repoId,
        executionHostId: repo.executionHostId,
        catalogRevision: input.catalogRevision,
        authorityRequirement: input.authorityRequirement
      })
    )
    const outcomes = await awaitRepoLeases(operation.leases)
    const repoOutcomes = countRepoOutcomes(outcomes)
    if (operation.invalidatedAs) {
      return terminalPreparationOutcome(operation.invalidatedAs, repoOutcomes)
    }
    if (!deps.isCurrentAuthority(input)) {
      return terminalPreparationOutcome('stale', repoOutcomes)
    }
    if (hasOutcome(repoOutcomes, ['canceled', 'stale'])) {
      const status = repoOutcomes.stale > 0 ? 'stale' : 'canceled'
      return terminalPreparationOutcome(status, repoOutcomes)
    }

    let lineageOutcome: DirectSshLineageOutcome
    try {
      lineageOutcome = await deps.readLineage(input)
    } catch {
      lineageOutcome = 'degraded'
    }
    if (operation.invalidatedAs) {
      return terminalPreparationOutcome(operation.invalidatedAs, repoOutcomes)
    }
    if (!deps.isCurrentAuthority(input) || lineageOutcome === 'stale') {
      return terminalPreparationOutcome('stale', repoOutcomes)
    }
    if (lineageOutcome === 'canceled') {
      return terminalPreparationOutcome('canceled', repoOutcomes)
    }
    const degraded =
      lineageOutcome === 'degraded' ||
      TERMINAL_STATUSES.some((status) => status !== 'complete' && repoOutcomes[status] > 0)
    const status = degraded ? 'degraded' : 'complete'
    return {
      status,
      token: buildPreparationToken(input, status),
      repoOutcomes,
      lineageOutcome
    }
  }

  const acquire = (rawInput: DirectSshPreparationInput): Promise<DirectSshPreparationOutcome> => {
    const input = normalizeDirectSshPreparationInput(rawInput)
    const key = directSshPreparationOperationKey(input)
    const current = operations.get(key)
    if (current) {
      return current.promise
    }
    if (stopped) {
      return Promise.resolve(
        terminalPreparationOutcome('stopped', createEmptyDirectSshRepoOutcomeCounts())
      )
    }
    const operation: PreparationOperation = {
      key,
      input,
      leases: [],
      invalidatedAs: null,
      settleInvalidation: () => {},
      invalidation: Promise.resolve('stopped'),
      promise: Promise.resolve(
        terminalPreparationOutcome('stopped', createEmptyDirectSshRepoOutcomeCounts())
      )
    }
    operation.invalidation = new Promise((resolve) => {
      operation.settleInvalidation = resolve
    })
    operations.set(key, operation)
    operation.promise = Promise.race([
      run(operation),
      operation.invalidation.then((reason) =>
        terminalPreparationOutcome(reason, createEmptyDirectSshRepoOutcomeCounts())
      )
    ]).finally(() => {
      if (operations.get(key) === operation) {
        operations.delete(key)
      }
    })
    return operation.promise
  }

  const invalidateMatching = (
    predicate: (operation: PreparationOperation) => boolean,
    reason: 'stale' | 'stopped'
  ): void => {
    for (const operation of operations.values()) {
      if (!predicate(operation)) {
        continue
      }
      operation.invalidatedAs = reason
      operation.settleInvalidation(reason)
      for (const lease of operation.leases) {
        lease.release(reason === 'stopped' ? 'stopped' : 'invalidated')
      }
    }
  }

  const invalidateAuthority = (authority: DirectSshAuthority): void => {
    invalidateMatching(
      (operation) => directSshAuthoritiesEqual(operation.input, authority),
      'stale'
    )
  }

  const invalidateTarget = (targetId: string): void => {
    invalidateMatching((operation) => operation.input.targetId === targetId, 'stale')
  }

  const stop = (): void => {
    if (stopped) {
      return
    }
    stopped = true
    invalidateMatching(() => true, 'stopped')
  }

  return { acquire, invalidateAuthority, invalidateTarget, stop }
}
