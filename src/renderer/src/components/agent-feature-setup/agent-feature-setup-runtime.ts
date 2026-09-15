import type { ProjectAgentSkillRuntime } from '@/lib/project-skill-runtime'

export type AgentFeatureSetupRuntimeContext = {
  agentRuntime?: ProjectAgentSkillRuntime
  installDisabledReason: string | null
  terminalShellOverride?: string
}

export function getAgentFeatureSetupAgentRuntime(
  context: AgentFeatureSetupRuntimeContext
): ProjectAgentSkillRuntime | undefined {
  return context.installDisabledReason ? undefined : context.agentRuntime
}
