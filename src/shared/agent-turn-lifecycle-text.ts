import type { AgentJournalTurnLifecycleState } from './agent-session-journal-types'

/** Fallback text on a lifecycle row for readers that render status text raw.
 *  Must never overstate what the host knows: an unobserved end is not "completed". */
export function agentTurnLifecycleText(state: AgentJournalTurnLifecycleState): string {
  switch (state) {
    case 'running':
      return 'Claude is working…'
    case 'completed':
      return 'Claude turn completed'
    case 'interrupted':
      return 'Claude turn interrupted'
    case 'unverifiable':
      return 'Claude turn outcome unverifiable'
  }
}
