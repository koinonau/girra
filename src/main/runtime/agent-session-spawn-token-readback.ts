/**
 * Reads the spawn token a live child carries in its environment, giving the owner probe a
 * PID-reuse-safe identity element even when no start time was recorded. Only Linux exposes
 * another process's environment (/proc/<pid>/environ); macOS and Windows answer null, which
 * the probe treats as "no answer" — never as proof in either direction.
 */

import { readFile } from 'node:fs/promises'
import type { AgentSessionProcessIdentity } from '../../shared/agent-session-record'

/** The child echoes its spawn token here so the owner probe can tell a live
 *  child of this reservation from a same-pid stranger. */
export const AGENT_SESSION_SPAWN_TOKEN_ENV = 'GIRRA_AGENT_SESSION_SPAWN_TOKEN'

export function spawnTokenFromEnvironBlock(
  block: string,
  variable: string = AGENT_SESSION_SPAWN_TOKEN_ENV
): string | null {
  for (const entry of block.split('\0')) {
    if (entry.startsWith(`${variable}=`)) {
      const value = entry.slice(variable.length + 1)
      return value.length > 0 ? value : null
    }
  }
  return null
}

export async function readEchoedAgentSessionSpawnToken(
  identity: AgentSessionProcessIdentity,
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  if (platform !== 'linux') {
    return null
  }
  try {
    return spawnTokenFromEnvironBlock(await readFile(`/proc/${identity.pid}/environ`, 'utf-8'))
  } catch {
    return null
  }
}
