import {
  CLAUDE_IDLE,
  containsAgentSpinnerGlyph,
  isClaudeManagementTitle,
  isPiAgentTitle,
  titleHasAgentName
} from './agent-title-core'
import { isOpenCodeNativeTitle } from './opencode-terminal-title'
import { getPiCompatibleSyntheticAgentLabel } from './pi-compatible-synthetic-title'
import { memoizeTitleClassification } from './terminal-title-classification-memo'

/**
 * Returns true when the terminal title matches Claude Code's title conventions.
 * Used to scope prompt-cache-timer behavior to Claude sessions only.
 */
function computeIsClaudeAgent(title: string): boolean {
  if (!title || isClaudeManagementTitle(title) || isOpenCodeNativeTitle(title)) {
    return false
  }
  const lower = title.toLowerCase()

  // Why: Claude title prefixes are stronger than task text, which can mention
  // other agents without changing the owning CLI.
  if (title.startsWith(`${CLAUDE_IDLE} `) || title === CLAUDE_IDLE) {
    return true
  }
  if (title.startsWith('. ') || title.startsWith('* ')) {
    return true
  }
  if (containsAgentSpinnerGlyph(title)) {
    // Why: OpenClaude titles carry the same spinner frames but are not Claude.
    return !lower.includes('openclaude')
  }

  const trimmedTitle = title.trimStart()
  return (
    trimmedTitle.toLowerCase().startsWith('claude') && titleHasAgentName(trimmedTitle, 'claude')
  )
}

/** Pure in `title` — memoized so repeated selector reads skip the regex ladder. */
export const isClaudeAgent: (title: string) => boolean =
  memoizeTitleClassification(computeIsClaudeAgent)

function computeAgentLabel(title: string): string | null {
  if (isClaudeManagementTitle(title)) {
    return null
  }
  // Why: the native marker owns the whole title; its session text may name or
  // include status glyphs from other agents without changing OpenCode identity.
  if (isOpenCodeNativeTitle(title)) {
    return 'OpenCode'
  }
  // Why: Claude task titles can mention another CLI; the prefix is the identity
  // signal, not arbitrary task text.
  if (
    title.startsWith(`${CLAUDE_IDLE} `) ||
    title === CLAUDE_IDLE ||
    title.startsWith('. ') ||
    title.startsWith('* ')
  ) {
    return 'Claude Code'
  }
  // Why: Pi-compatible synthetic titles can carry braille spinners, which the
  // generic agent-title heuristics would otherwise claim first.
  const piCompatibleSyntheticAgentLabel = getPiCompatibleSyntheticAgentLabel(title)
  if (piCompatibleSyntheticAgentLabel) {
    return piCompatibleSyntheticAgentLabel
  }
  if (isPiAgentTitle(title)) {
    return 'Pi'
  }

  if (titleHasAgentName(title, 'opencode')) {
    return 'OpenCode'
  }
  if (isClaudeAgent(title)) {
    return 'Claude Code'
  }

  return null
}

/** Pure in `title` — memoized so repeated selector reads skip the regex ladder. */
export const getAgentLabel: (title: string) => string | null =
  memoizeTitleClassification(computeAgentLabel)
