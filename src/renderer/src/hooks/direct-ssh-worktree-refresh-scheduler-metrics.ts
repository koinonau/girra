import type {
  DirectSshWorktreeRefreshLogicalTask,
  DirectSshWorktreeRefreshSchedulerSnapshot
} from './direct-ssh-worktree-refresh-scheduler-types'

export function adjustDirectSshAuthorityUnsettled(
  unsettledByAuthority: Map<string, number>,
  authorityId: string,
  delta: number
): void {
  const next = (unsettledByAuthority.get(authorityId) ?? 0) + delta
  if (next > 0) {
    unsettledByAuthority.set(authorityId, next)
  } else {
    unsettledByAuthority.delete(authorityId)
  }
}

export function directSshWorktreeRefreshSchedulerSnapshot(
  tasks: ReadonlyMap<string, DirectSshWorktreeRefreshLogicalTask>,
  locallyUnsettled: number,
  cancelDebtByAuthority: ReadonlyMap<string, number>
): DirectSshWorktreeRefreshSchedulerSnapshot {
  let queued = 0
  let retrying = 0
  let waiters = 0
  for (const task of tasks.values()) {
    queued += task.state === 'queued' ? 1 : 0
    retrying += task.state === 'retrying' ? 1 : 0
    waiters += task.waiters.size
  }
  return {
    locallyUnsettled,
    queued,
    retrying,
    logicalTasks: tasks.size,
    waiters,
    cancelDebtByAuthority: new Map(cancelDebtByAuthority)
  }
}
