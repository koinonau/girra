// Single source of truth for native chat slash-command behavior, shared by the
// desktop renderer and the mobile app. This is pure data + string helpers (no
// DOM, no RN-only imports), so both platforms import the SAME values — no
// mirrored copy to drift, unlike the agent-specific parsers in src/shared that
// Metro forces us to duplicate.

import type { AgentSessionSlashCommand } from './agent-session-wire'
import type { AgentType } from './agent-status-types'

export type SlashCommandSuggestion = {
  /** The command token without its leading slash, e.g. `clear`. */
  name: string
  /** Optional one-line description for the suggestion row. */
  description?: string
  /** Provider-authored argument sketch, e.g. `<objective>`. */
  argumentHint?: string
  kindUnspecified?: true
}

// Best-effort, curated per-agent catalogs. The CLIs ship no machine-readable
// command list, so these track the common, stable commands each TUI documents.
// The composer treats commands as plain data, so this can grow freely.

const COMMON_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'clear', description: 'Clear the conversation' },
  { name: 'help', description: 'Show available commands' }
]

const CLAUDE_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Summarize and compact the conversation' },
  { name: 'init', description: 'Initialize a CLAUDE.md' },
  { name: 'review', description: 'Review the current changes' },
  { name: 'help', description: 'Show available commands' }
]

const COMMANDS_BY_AGENT: Partial<Record<AgentType, readonly SlashCommandSuggestion[]>> = {
  claude: CLAUDE_COMMANDS
}

/** Known slash commands for an agent, falling back to a small common set so the
 *  `/` menu is never empty for a recognized agent. */
export function getAgentSlashCommands(agent: AgentType): readonly SlashCommandSuggestion[] {
  return COMMANDS_BY_AGENT[agent] ?? COMMON_COMMANDS
}

/** The command rows for a session that reports its own `/` surface. The report
 *  is the authority on WHICH commands exist and, when it carries one, on how a
 *  command is described; the curated catalog above only covers the names whose
 *  report is text-free. Skills are excluded — they render in the picker's own
 *  skills group. */
export function sessionSlashCommandSuggestions(
  agent: AgentType,
  reported: readonly AgentSessionSlashCommand[]
): readonly SlashCommandSuggestion[] {
  const described = new Map(
    getAgentSlashCommands(agent).map((command) => [command.name, command.description])
  )
  return reported
    .filter((entry) => entry.kind === 'command')
    .map((entry) => {
      const description = entry.description ?? described.get(entry.name)
      return {
        name: entry.name,
        ...(description ? { description } : {}),
        ...(entry.argumentHint ? { argumentHint: entry.argumentHint } : {}),
        ...(entry.kindUnspecified ? { kindUnspecified: true as const } : {})
      }
    })
}

/** Names the session reported as skills, in the order it reported them. */
export function sessionReportedSkillNames(
  reported: readonly AgentSessionSlashCommand[]
): readonly string[] {
  return reported.filter((entry) => entry.kind === 'skill').map((entry) => entry.name)
}

/** Whether the draft is a slash command (leading `/`, ignoring leading space).
 *  Slash drafts dispatch to the agent's own TUI and must NOT render an optimistic
 *  user bubble — they are control actions, not chat turns. */
export function isSlashCommandDraft(draft: string): boolean {
  return draft.trimStart().startsWith('/')
}

/** Case-insensitive prefix filter over an agent's commands. An empty query
 *  returns all commands so a bare `/` shows the full menu. */
export function filterSlashCommands(
  commands: readonly SlashCommandSuggestion[],
  query: string
): SlashCommandSuggestion[] {
  const normalized = query.toLowerCase()
  if (normalized === '') {
    return [...commands]
  }
  return commands.filter((command) => command.name.toLowerCase().startsWith(normalized))
}

/** Replace the slash token with the chosen command plus a trailing space, so the
 *  user can type arguments. This is the Tab-completion path. */
export function applySlashSuggestion(command: SlashCommandSuggestion): string {
  return `/${command.name} `
}

/** Text to send when Enter accepts a slash command from the menu — no trailing
 *  space, because the TUI dispatches the command on Enter. */
export function slashCommandDispatchText(command: SlashCommandSuggestion): string {
  return `/${command.name}`
}

export type NativeChatSendClassification = 'chat' | 'command' | 'unknown-token'

export function classifyNativeChatSend(
  draft: string,
  commands: readonly SlashCommandSuggestion[],
  pickerSkillOriginToken: string | null
): NativeChatSendClassification {
  // Why: the supported TUIs only treat a line-leading token as a command, so a
  // draft with leading whitespace is prose; trimming here would claim a "Ran"
  // line for text the agent never dispatched.
  const firstToken = draft.split(/\s/, 1)[0] ?? ''
  if (pickerSkillOriginToken && firstToken === pickerSkillOriginToken) {
    return 'chat'
  }
  if (commands.some((command) => firstToken === `/${command.name}`)) {
    return 'command'
  }
  if (firstToken.startsWith('/')) {
    return 'unknown-token'
  }
  return 'chat'
}
