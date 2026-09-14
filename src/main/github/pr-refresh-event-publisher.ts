import type {
  GitHubPRRefreshCandidate,
  GitHubPRRefreshEvent,
  PRRefreshOutcome
} from '../../shared/github/pull-request-refresh-types'
import { sendToTrustedUIRenderer } from '../ipc/ui'

export type PRRefreshOutcomeObserver = (
  candidate: GitHubPRRefreshCandidate,
  outcome: PRRefreshOutcome
) => void

export class PRRefreshEventPublisher {
  private sequence = 0
  private observer: PRRefreshOutcomeObserver | null = null

  setOutcomeObserver(observer: PRRefreshOutcomeObserver | null): void {
    this.observer = observer
  }

  observe(candidate: GitHubPRRefreshCandidate, outcome: PRRefreshOutcome): void {
    this.observer?.(candidate, outcome)
  }

  nextSequence(): number {
    this.sequence += 1
    return this.sequence
  }

  broadcast(event: Omit<GitHubPRRefreshEvent, 'sequence'>, sequenceOverride?: number): void {
    const payload = {
      ...event,
      sequence: sequenceOverride ?? this.nextSequence()
    } as GitHubPRRefreshEvent
    sendToTrustedUIRenderer('gh:prRefreshEvent', payload)
  }
}
