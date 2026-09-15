import { toLinuxPath } from '../wsl'
import type { SkillProviderRootOverrides } from '../skills/skill-provider-destinations'
import {
  resolveEnvironmentSkillProviderRoots,
  withClaudeSkillProviderRoot
} from '../skills/skill-provider-runtime-roots'

export type SkillDiscoveryProviderRootsTarget = { kind: 'native-host' | 'wsl'; distro?: string }

type ClaudeConfigDirectoryLookup = (
  target: { runtime: 'host' } | { runtime: 'wsl'; wslDistro: string }
) => string | null

export type RuntimeSkillDiscoveryProviderRootsSurface = {
  resolveSkillDiscoveryProviderRoots(
    target: SkillDiscoveryProviderRootsTarget
  ): Promise<SkillProviderRootOverrides>
}

export async function resolveSkillDiscoveryProviderRoots(
  target: SkillDiscoveryProviderRootsTarget,
  getClaudeConfigDirectory: ClaudeConfigDirectoryLookup
): Promise<SkillProviderRootOverrides> {
  const wslDistro = target.kind === 'wsl' ? target.distro : undefined
  const roots = withClaudeSkillProviderRoot(
    wslDistro ? {} : resolveEnvironmentSkillProviderRoots(),
    getClaudeConfigDirectory(wslDistro ? { runtime: 'wsl', wslDistro } : { runtime: 'host' })
  )
  return target.kind === 'wsl'
    ? Object.fromEntries(
        Object.entries(roots).map(([provider, root]) => [provider, toLinuxPath(root)])
      )
    : roots
}
