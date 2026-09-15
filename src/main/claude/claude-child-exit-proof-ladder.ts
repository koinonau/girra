import type { SpawnedProcess } from '../../shared/child-process/run-process'
import type { ClaudeChildTreeReaper } from './claude-agent-sdk-exit-proof'

const GRACEFUL_EXIT_MS = 1_500
const FORCED_EXIT_MS = 1_000

export type ClaudeChildExitProofInput = {
  child: Pick<SpawnedProcess, 'pid' | 'kill' | 'stdin'>
  exitPromise: Promise<void>
  exited: () => boolean
  tree?: ClaudeChildTreeReaper
}

export async function proveClaudeChildExitWithReaper(
  input: ClaudeChildExitProofInput,
  createTree: () => ClaudeChildTreeReaper
): Promise<boolean> {
  const tree = input.tree ?? createTree()
  // Arm before stdin closes: only a live root can identify its descendants.
  await tree.capture()
  try {
    input.child.stdin?.end()
  } catch {
    // The reap below still owns the process.
  }
  let reaped = false
  if (!input.exited()) {
    await waitForProcessExitUntil(input.exitPromise, GRACEFUL_EXIT_MS)
    if (!input.exited()) {
      reaped = true
      await tree.refresh?.()
      await tree.reap()
      await waitForProcessExitUntil(input.exitPromise, FORCED_EXIT_MS)
    }
  }
  if (!reaped && input.exited() && tree.treeVerdict !== 'exited') {
    await tree.reap()
  }
  return input.exited() && tree.treeVerdict === 'exited'
}

async function waitForProcessExitUntil(
  exitPromise: Promise<void>,
  timeoutMs: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  try {
    await Promise.race([exitPromise, timeout])
  } finally {
    // Why: a live grace timer would keep a short-lived parent alive after the child exited.
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}
