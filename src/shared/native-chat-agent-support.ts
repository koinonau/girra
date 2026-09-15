import type { TuiAgent } from './tui-agent'

export type NativeChatTranscriptAgent = 'claude'

/** Agents whose transcripts the native chat view can parse and render, in the
 *  order the settings pane advertises them. */
export const NATIVE_CHAT_SUPPORTED_AGENT_LIST: readonly TuiAgent[] = ['claude']

export const NATIVE_CHAT_SUPPORTED_AGENTS: ReadonlySet<string> = new Set(
  NATIVE_CHAT_SUPPORTED_AGENT_LIST
)

export function isNativeChatSupportedAgent(agent: string | null | undefined): boolean {
  return agent != null && NATIVE_CHAT_SUPPORTED_AGENTS.has(agent)
}

export function resolveNativeChatTranscriptAgent(
  agent: string | null | undefined
): NativeChatTranscriptAgent | null {
  return agent === 'claude' ? 'claude' : null
}
