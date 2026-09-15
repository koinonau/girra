import { AgentAwakeService } from '../agent-awake-service'
import { normalizeComputerAwakeMode } from '../../shared/computer-awake-mode'
import { registerSystemResumeBroadcast } from '../system-resume-broadcast'
import { agentHookServer } from '../agent-hooks/server'
import { installHookStatusSessionTabsRepublish } from '../agent-hooks/hook-status-session-tabs-republish'
import { initObservability } from '../observability'
import { StatsCollector } from '../stats/collector'
import { AgentSessionTransitionRecorder } from '../stats/agent-session-transition-recorder'
import { ClaudeUsageStore } from '../claude-usage/store'
import { OpenCodeUsageStore } from '../opencode-usage/store'
import { installRepoMaintenanceIdleGate } from '../repo-maintenance-idle-gate'
import { mainProcessState as state } from './main-process-state'

export function initializeMainProcessObservers(): void {
  const store = state.store
  if (!store) {
    throw new Error('Store must be initialized before observers')
  }
  state.unsubscribeSystemResumeBroadcast = registerSystemResumeBroadcast()
  state.agentAwakeService = new AgentAwakeService()
  state.agentAwakeService.setMode(
    normalizeComputerAwakeMode(
      store.getSettings().computerAwakeMode,
      store.getSettings().keepComputerAwakeWhileAgentsRun
    )
  )
  // Why: start from empty — disk-hydrated status rows are UI continuity only; only this runtime's hook events keep the computer awake.
  state.agentAwakeService.setStatuses([])
  state.uninstallRepoMaintenanceIdleGate = installRepoMaintenanceIdleGate({
    isQuitting: () => state.isQuitting,
    getWorkingAgentCount: () => state.agentAwakeService?.getWorkingAgentCount() ?? 0
  })
  const unsubscribeStatusChanges = agentHookServer.subscribeStatusChanges((statuses) => {
    state.agentAwakeService?.setStatuses(statuses)
  })
  const unsubscribeStatusFreshness = agentHookServer.subscribeStatusFreshness((status) => {
    state.agentAwakeService?.observeStatusFreshness(status)
  })
  const uninstallHookStatusRepublish = installHookStatusSessionTabsRepublish(
    agentHookServer,
    () => state.runtime
  )
  state.unsubscribeAgentAwakeStatusChanges = () => {
    unsubscribeStatusChanges()
    unsubscribeStatusFreshness()
    uninstallHookStatusRepublish()
  }
  // Why: observability must initialize before any IPC handler or runtime span exists so the
  // tracer's sink is ready for the first span. It applies its own consent and CI gates.
  initObservability()
  state.stats = new StatsCollector()
  // Agent-session stats come from hook status transitions, the same truth the
  // sidebar and dashboard read — never from OSC terminal titles, which miss
  // hook-only agents and count any spinner TUI as an agent (#10201).
  const agentSessionRecorder = new AgentSessionTransitionRecorder(state.stats)
  agentHookServer.subscribeEnrichedStatus((enriched) => agentSessionRecorder.onStatus(enriched))
  agentHookServer.subscribePaneStatusClear((clear) => agentSessionRecorder.onCleared(clear))
  state.claudeUsage = new ClaudeUsageStore(store)
  state.openCodeUsage = new OpenCodeUsageStore(store)
}
