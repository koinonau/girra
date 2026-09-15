import type { SessionFileCandidate, SessionFileDiscovery } from './session-scanner-types'

/** Newest-first parse candidates for a discovery set. */
export function sessionCandidatesFromDiscoveries(
  discoveries: SessionFileDiscovery[]
): SessionFileCandidate[] {
  return discoveries
    .flatMap((discovery) =>
      discovery.files.map((file): SessionFileCandidate => ({ agent: discovery.agent, file }))
    )
    .sort((left, right) => right.file.mtimeMs - left.file.mtimeMs)
}
