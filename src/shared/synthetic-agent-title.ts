import type { AgentStatusState, AgentType } from './agent-status-types'
import type { TuiAgent } from './tui-agent'

export type SyntheticAgentTitleProfile = {
  workingLabel: string
  permissionLabel: string
  idleLabel: string
  titleIdentityGroup?: string
  synthesizeTerminalTitle?: boolean
  synthesizeWorkingTitle?: boolean
}

export const SYNTHETIC_AGENT_TITLE_AGENTS = [
  'opencode',
  'pi'
] as const satisfies readonly TuiAgent[]

export const SYNTHETIC_AGENT_TITLE_PROFILES: Record<string, SyntheticAgentTitleProfile> = {
  opencode: {
    workingLabel: 'OpenCode',
    permissionLabel: 'OpenCode - action required',
    idleLabel: 'OpenCode ready',
    // Why: OpenCode owns semantic OSC session titles; hook status must not replace them.
    synthesizeTerminalTitle: false
  },
  pi: {
    workingLabel: 'Pi',
    permissionLabel: 'Pi - action required',
    idleLabel: 'Pi ready',
    titleIdentityGroup: 'pi-compatible',
    // Why: Pi owns its working OSC title (`π ⠋ <session>`) and animates it itself. Synthesizing
    // over it replaced the session label and fought its frames at 80ms. Terminal states still
    // synthesize: they carry the pane's agent identity downstream, and Pi is quiet at rest.
    synthesizeWorkingTitle: false
  }
}

const SYNTHETIC_PERMISSION_TITLES: ReadonlySet<string> = new Set(
  Object.values(SYNTHETIC_AGENT_TITLE_PROFILES)
    .filter((profile) => profile.synthesizeTerminalTitle !== false)
    .map((profile) => profile.permissionLabel.toLowerCase())
)

export function isSyntheticAgentPermissionTitle(title: string): boolean {
  return SYNTHETIC_PERMISSION_TITLES.has(title.trim().toLowerCase())
}

export function getSyntheticAgentTitleProfile(
  agentType: AgentType | null | undefined
): SyntheticAgentTitleProfile | null {
  if (!agentType) {
    return null
  }
  return SYNTHETIC_AGENT_TITLE_PROFILES[agentType] ?? null
}

export function getSyntheticAgentTerminalTitle(
  agentType: AgentType | null | undefined,
  state: AgentStatusState
): string | null {
  const profile = getSyntheticAgentTitleProfile(agentType)
  if (!profile || profile.synthesizeTerminalTitle === false || state === 'working') {
    return null
  }
  return state === 'blocked' || state === 'waiting' ? profile.permissionLabel : profile.idleLabel
}

export function shouldDriveSyntheticAgentTitleFromHook(
  agentType: AgentType | null | undefined,
  state: AgentStatusState
): boolean {
  const profile = getSyntheticAgentTitleProfile(agentType)
  if (!profile || profile.synthesizeTerminalTitle === false) {
    return false
  }
  return state !== 'working' || profile.synthesizeWorkingTitle !== false
}
