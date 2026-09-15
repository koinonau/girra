import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { sessionCandidatesFromDiscoveries } from '../ai-vault/session-scanner-candidates'
import { discoverAiVaultSessionSources } from '../ai-vault/session-scanner-source-discovery'
import type {
  AiVaultScanOptions,
  SessionFileCandidate,
  SessionFileDiscovery
} from '../ai-vault/session-scanner-types'

/** One real directory a scan walked, and what it listed there. */
export type SessionSearchRootListing = { root: string; files: number }

/**
 * Where the indexer looks. The caller resolves these so the index enumerates
 * exactly the trees the session list does; the indexer owns the bounds
 * (`limit`, `limitPerAgent`, `unlimited`) and its own cancellation, so those
 * are not the caller's to set.
 */
export type SessionSearchScanRoots = Omit<
  AiVaultScanOptions,
  'signal' | 'limit' | 'unlimited' | 'limitPerAgent' | 'scopePaths'
>

export type SessionSearchDiscovery = {
  /** Newest first, exactly as a list scan sees them. */
  candidates: SessionFileCandidate[]
  discoveries: SessionFileDiscovery[]
  issues: AiVaultScanIssue[]
}

/**
 * The discovery half of a list scan, without the parse. `limitPerAgent` is the
 * sidebar's own recency rule (`SessionNewestFiles` keeps the newest N per root);
 * passing Infinity is what makes a sweep whole.
 */
export async function discoverSessionSearchCandidates(
  roots: SessionSearchScanRoots,
  args: { limitPerAgent: number; signal?: AbortSignal }
): Promise<SessionSearchDiscovery> {
  const issues: AiVaultScanIssue[] = []
  const options: AiVaultScanOptions = { ...roots, signal: args.signal }
  const discoveries = await discoverAiVaultSessionSources({
    options,
    limitPerAgent: args.limitPerAgent,
    issues
  })
  const candidates = sessionCandidatesFromDiscoveries(discoveries)
  return { candidates, discoveries, issues }
}

/**
 * Containment on path segments, not on string prefix, and on both separators:
 * discovery joins with the platform's, a configured root can arrive spelled
 * with the other, and `/a/agents-old` is not inside `/a/agents`.
 */
export function isUnderScanRoot(path: string, root: string): boolean {
  return root.length > 0 && (path.startsWith(`${root}/`) || path.startsWith(`${root}\\`))
}

/**
 * The directories a scan's discoveries walked, with the files found under each.
 * A synthetic `<db>#<id>` row is not under its store's path, so it counts for no root.
 */
export function sessionSearchRootListings(
  discoveries: readonly SessionFileDiscovery[]
): SessionSearchRootListing[] {
  const counts = new Map<string, number>()
  for (const discovery of discoveries) {
    const files = discovery.files.filter((file) =>
      isUnderScanRoot(file.path, discovery.rootDir)
    ).length
    counts.set(discovery.rootDir, (counts.get(discovery.rootDir) ?? 0) + files)
  }
  return [...counts].map(([root, files]) => ({ root, files }))
}

/**
 * Roots that listed transcripts on the previous pass and list none on this one.
 *
 * The one bit of memory the retirement walk gets, and what it buys: a root that
 * blinks empty for a single pass is unverifiable rather than proven gone, so a
 * sync client swapping a directory out cannot retire a tree. It is deliberately
 * not evidence that survives the process — see the invariant block in
 * `session-search-deleted-sources.ts` for what that costs and why.
 */
export function sessionSearchEmptiedRoots(
  previous: ReadonlySet<string>,
  current: ReadonlySet<string>
): Set<string> {
  return new Set([...previous].filter((root) => !current.has(root)))
}
