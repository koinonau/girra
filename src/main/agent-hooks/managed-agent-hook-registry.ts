import type { AgentHookInstallStatus, AgentHookTarget } from '../../shared/agent-hook-types'
import { claudeHookService } from '../claude/hook-service'

export type ManagedAgentHookInstaller = readonly [
  AgentHookTarget,
  () => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookScriptRefresher = readonly [AgentHookTarget, () => Promise<void>]
export type ManagedAgentHookRemover = readonly [
  AgentHookTarget,
  () => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookStatusReader = readonly [AgentHookTarget, () => AgentHookInstallStatus]

export const MANAGED_AGENT_HOOK_INSTALLERS: readonly ManagedAgentHookInstaller[] = [
  ['claude', () => claudeHookService.install()]
]

// Why: covers the shared launcher/statusline scripts under ~/.orca/agent-hooks — the files a
// user-wide agent config keeps invoking after the CLI falls off PATH. Enforced by the coverage
// test in managed-hook-script-refresh.test.ts: a new installer that writes a launcher without
// adding a refresher here fails that test.
export const MANAGED_AGENT_HOOK_SCRIPT_REFRESHERS: readonly ManagedAgentHookScriptRefresher[] = [
  ['claude', () => claudeHookService.refreshManagedScripts()]
]

export const MANAGED_AGENT_HOOK_REMOVERS: readonly ManagedAgentHookRemover[] = [
  ['claude', () => claudeHookService.remove()]
]

export const MANAGED_AGENT_HOOK_STATUS_READERS: readonly ManagedAgentHookStatusReader[] = [
  ['claude', () => claudeHookService.getStatus()]
]
