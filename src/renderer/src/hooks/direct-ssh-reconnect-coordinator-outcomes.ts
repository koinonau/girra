import type {
  DirectSshPreparationOutcome,
  DirectSshReconnectOutcome,
  DirectSshRepoOutcomeCounts
} from './direct-ssh-reconnect-coordinator-types'

export function createEmptyDirectSshRepoOutcomeCounts(): DirectSshRepoOutcomeCounts {
  return {
    complete: 0,
    'non-authoritative': 0,
    'timed-out': 0,
    'cancel-budget-exhausted': 0,
    canceled: 0,
    stale: 0,
    rejected: 0
  }
}

export function combineDirectSshReconnectOutcome(
  prepared: DirectSshPreparationOutcome,
  staleBindingsCleared: number,
  retriedTerminals: number,
  correctedTerminals: number
): DirectSshReconnectOutcome {
  return {
    ...prepared,
    staleBindingsCleared,
    retriedTerminals,
    correctedTerminals,
    stabilizing: false
  }
}

export function createTerminalOnlyDirectSshReconnectOutcome(
  status: DirectSshReconnectOutcome['status'],
  staleBindingsCleared = 0,
  retriedTerminals = 0
): DirectSshReconnectOutcome {
  return {
    status,
    token: null,
    repoOutcomes: createEmptyDirectSshRepoOutcomeCounts(),
    lineageOutcome: 'not-started',
    staleBindingsCleared,
    retriedTerminals,
    correctedTerminals: 0,
    stabilizing: status === 'stabilizing'
  }
}
