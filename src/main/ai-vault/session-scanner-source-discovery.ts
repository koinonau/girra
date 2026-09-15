import type { AiVaultAgent, AiVaultScanIssue } from '../../shared/ai-vault-types'
import { discoverFiles } from './session-scanner-discovery'
import { opencodeDiscoveries } from './session-scanner-opencode-sources'
import { AI_VAULT_AGENT_SOURCES, type AiVaultAgentSource } from './session-scanner-agent-sources'
import { normalizedWslHomeDirs } from './session-scanner-roots'
import type { AiVaultScanOptions, SessionFileDiscovery } from './session-scanner-types'

export async function discoverAiVaultSessionSources(args: {
  options: AiVaultScanOptions
  limitPerAgent: number
  issues: AiVaultScanIssue[]
}): Promise<SessionFileDiscovery[]> {
  const { options, limitPerAgent, issues } = args
  const wslHomeDirs = normalizedWslHomeDirs(options.wslHomeDirs)

  return Promise.all([
    // Why: OpenCode 1.17.x migrated sessions from per-session JSON files to a
    // SQLite DB. discoverOpenCodeSessions runs both the file scanner (legacy)
    // and the SQLite scanner (1.17.x); dedup by sessionId happens inside.
    ...opencodeDiscoveries(options, wslHomeDirs, limitPerAgent, issues),
    ...Object.entries(AI_VAULT_AGENT_SOURCES).flatMap(([agent, source]) =>
      source
        ? agentDiscoveries(
            agent as AiVaultAgent,
            source,
            options,
            wslHomeDirs,
            limitPerAgent,
            issues
          )
        : []
    )
  ])
}

function agentDiscoveries(
  agent: AiVaultAgent,
  source: AiVaultAgentSource,
  options: AiVaultScanOptions,
  wslHomeDirs: readonly string[],
  limit: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery>[] {
  const rootDirs = source.rootDirs(options, wslHomeDirs)
  const discover = (rootDir: string): Promise<SessionFileDiscovery> =>
    discoverFiles({
      rootDir,
      limit,
      agent,
      issues,
      extensions: [...source.extensions],
      filePredicate: source.filePredicate,
      directoryPredicate: source.directoryPredicate
    })
  return rootDirs.map(discover)
}
