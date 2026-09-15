import type { AgentType } from './agent-status-types'
import { getAgentSlashCommands, type SlashCommandSuggestion } from './native-chat-slash-commands'

export type NativeChatAgentProfile = {
  skillSourceOwner: AgentType
  /** The agent's own harness expands a slash command out of the message text, so
   *  the chat host claims only the commands it implements itself. */
  expandsSlashCommandsFromText?: true
}

const NATIVE_CHAT_AGENT_PROFILES: Partial<Record<AgentType, NativeChatAgentProfile>> = {
  claude: {
    skillSourceOwner: 'claude',
    expandsSlashCommandsFromText: true
  }
}

export function getNativeChatAgentProfile(
  agent: AgentType | null | undefined
): NativeChatAgentProfile | null {
  return agent ? (NATIVE_CHAT_AGENT_PROFILES[agent] ?? null) : null
}

/** The catalog that send classification, collision detection, and transcript
 *  envelope surfacing key off. */
export function getVerifiedNativeChatCommands(agent: AgentType): readonly SlashCommandSuggestion[] {
  return getAgentSlashCommands(agent)
}

/** Catalog commands the chat host answers itself. Whatever is left over reaches
 *  the agent as ordinary text, which is only correct where the agent implements
 *  the command, so an agent unclaims its catalog only via the profile above.
 *  Claiming stays the default: it is what stops a hand-typed `/clear` from being
 *  sent to the model as literal prompt text. */
export function getHostClaimedNativeChatCommands(
  agent: AgentType
): readonly SlashCommandSuggestion[] {
  return getNativeChatAgentProfile(agent)?.expandsSlashCommandsFromText
    ? []
    : getVerifiedNativeChatCommands(agent)
}
