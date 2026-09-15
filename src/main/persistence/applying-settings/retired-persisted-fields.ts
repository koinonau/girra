import type { PersistedState } from '../../../shared/persisted-state-types'

// Why: read a settings field removed from GlobalSettings but still on disk; one-shot for the inline-agents migration.
export function readDeprecatedExperimentFlag(parsed: PersistedState | undefined): boolean {
  return (
    (parsed?.settings as { experimentalAgentDashboard?: boolean } | undefined)
      ?.experimentalAgentDashboard === true
  )
}

export function readLegacySidekickFlag(parsed: PersistedState | undefined): boolean | undefined {
  return (parsed?.settings as { experimentalSidekick?: boolean } | undefined)?.experimentalSidekick
}

// Why: the onboarding wizard is retired, but profiles that closed it still carry its block on disk.
export function readRetiredOnboardingClosed(parsed: PersistedState | undefined): boolean {
  const onboarding = (
    parsed as { onboarding?: { closedAt?: unknown; outcome?: unknown } } | undefined
  )?.onboarding
  return (
    typeof onboarding?.closedAt === 'number' ||
    onboarding?.outcome === 'completed' ||
    onboarding?.outcome === 'dismissed'
  )
}
