/**
 * Parked-pane command-lifecycle status policy.
 * Why: parking unmounts TerminalPane, so OSC 133;D signals went dark.
 * This ports the store-level subset of pty-connection's handlers; the pane-coupled parts
 * (foreground process-confirm ladder, key-intent interrupt inference) stay with the mounted pane.
 */
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { parseAppSshPtyId } from '../../../../shared/ssh-pty-id'
import { dispatchTerminalCommandFinishedEvent } from '@/hooks/terminal-command-finished-event'
import { useAppStore } from '@/store'

export type ParkedTerminalCommandStatusPolicy = {
  onCommandFinished: (bestEffortExitCode: number | null) => void
  dispose: () => void
}

export function createParkedTerminalCommandStatusPolicy(options: {
  ptyId: string
  worktreeId: string
  paneKey: string
}): ParkedTerminalCommandStatusPolicy {
  const { ptyId, worktreeId, paneKey } = options
  let disposed = false

  // Port of pty-connection's dropCommandFinishedStatusIfSameTurn, minus the interrupt-inference
  // option: parked panes receive no key events, so inference never has evidence here.
  const dropCommandFinishedStatusIfSameTurn = (entry: AgentStatusEntry | undefined): void => {
    const state = useAppStore.getState()
    if (!entry) {
      // Why: an Orca-started agent can exit before its first hook status; clear the launch
      // registry on command exit like the mounted path does.
      state.clearAgentLaunchConfig(paneKey)
      return
    }
    const current = state.agentStatusByPaneKey[paneKey]
    if (!current) {
      state.clearAgentLaunchConfig(paneKey)
      return
    }
    const unchanged =
      current.state === entry.state &&
      current.prompt === entry.prompt &&
      current.updatedAt === entry.updatedAt &&
      current.stateStartedAt === entry.stateStartedAt &&
      current.agentType === entry.agentType
    if (!unchanged) {
      return
    }
    state.dropAgentStatus(paneKey)
  }

  return {
    onCommandFinished: (bestEffortExitCode: number | null): void => {
      if (disposed) {
        return
      }
      // Why: the finished command may have moved HEAD or the index (an agent running
      // `git checkout` in a parked worktree); nudge git UI now instead of waiting for a poll.
      dispatchTerminalCommandFinishedEvent(worktreeId, bestEffortExitCode)
      // Why: drop the same-turn status row only for SSH PTYs — exact parity with the mounted
      // path, whose foreground tracker refuses SSH ids and drops un-probed. Local PTYs need
      // pty-connection's process-confirm ladder to tell a leaked nested-shell 133;D from a
      // real agent exit, so their drop stays with the mounted pane.
      if (parseAppSshPtyId(ptyId) === null) {
        return
      }
      dropCommandFinishedStatusIfSameTurn(useAppStore.getState().agentStatusByPaneKey[paneKey])
    },

    dispose: (): void => {
      disposed = true
    }
  }
}
