// Maps `TuiAgent` to the closed `AgentKind` enum carried in terminal startup payloads.

import { z } from 'zod'
import type { TuiAgent } from './tui-agent'

export const AGENT_KIND_VALUES = [
  'claude-code',
  'claude-agent-teams',
  'opencode',
  'pi',
  'other'
] as const
export const agentKindSchema = z.enum(AGENT_KIND_VALUES)
export type AgentKind = z.infer<typeof agentKindSchema>

type ConcreteAgentKind = Exclude<AgentKind, 'other'>

const TUI_AGENT_KIND_BY_AGENT = {
  claude: 'claude-code',
  'claude-agent-teams': 'claude-agent-teams',
  opencode: 'opencode',
  pi: 'pi'
} satisfies Record<TuiAgent, ConcreteAgentKind>

// Why: `satisfies Record<TuiAgent, …>` makes the lookup exhaustive at compile
// time, but stale persisted settings or unsafe IPC casts can carry a string
// outside the union at runtime — fall back to `'other'` so the event still
// emits instead of failing validation and dropping silently.
export function tuiAgentToAgentKind(agent: TuiAgent): AgentKind {
  return TUI_AGENT_KIND_BY_AGENT[agent] ?? 'other'
}

// Why: the worktree-initial-terminal launch path only carries the startup payload's
// `agent_kind`, not the TuiAgent. Reverse the map so that path can stamp the
// tab's launch agent without threading TuiAgent through every startup builder.
const AGENT_BY_TUI_AGENT_KIND: Partial<Record<AgentKind, TuiAgent>> = Object.fromEntries(
  Object.entries(TUI_AGENT_KIND_BY_AGENT).map(([agent, kind]) => [kind, agent as TuiAgent])
)

export function agentKindToTuiAgent(kind: AgentKind | null | undefined): TuiAgent | null {
  if (!kind) {
    return null
  }
  return AGENT_BY_TUI_AGENT_KIND[kind] ?? null
}
