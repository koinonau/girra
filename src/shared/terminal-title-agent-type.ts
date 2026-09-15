import { titleHasAgentName } from './agent-name-token-match'
import { containsAgentSpinnerGlyph } from './agent-title-core'
import { isOpenCodeNativeTitle } from './opencode-terminal-title'
import {
  getPiCompatibleSyntheticAgentLabel,
  isLegacyPiCompatibleTitle
} from './pi-compatible-synthetic-title'
import { resolveCanonicalPaneAgentIdentity } from './pane-agent-identity-adapter'
import { memoizeTitleClassification } from './terminal-title-classification-memo'
import type { TuiAgent } from './tui-agent'

export const CLAUDE_IDLE = '\u2733' // ✳ (eight-spoked asterisk — Claude Code idle prefix)
const CLAUDE_MANAGEMENT_TITLE_RE =
  /^\s*(?:"(?:.*[\\/])?claude(?:\.(?:exe|cmd|bat|ps1))?"|'(?:.*[\\/])?claude(?:\.(?:exe|cmd|bat|ps1))?'|(?:.*[\\/])?claude(?:\.(?:exe|cmd|bat|ps1))?)\s+agents\s*$/i

export function isPiAgentTitle(title: string): boolean {
  return isLegacyPiCompatibleTitle(title)
}

/**
 * Returns true when the terminal title matches Claude Code's title conventions.
 * Used to scope prompt-cache-timer behavior to Claude sessions only — other
 * agents have different (or no) caching semantics.
 */
function computeIsClaudeAgent(title: string): boolean {
  if (!title || isClaudeManagementTitle(title) || isOpenCodeNativeTitle(title)) {
    return false
  }
  const lower = title.toLowerCase()

  // Why: Claude Code titles are prefixed with status indicators (✳, ". ", "* ",
  // braille spinners) followed by the task description. The task text can
  // legitimately mention other agents, so Claude-specific prefixes must win.
  if (title.startsWith(`${CLAUDE_IDLE} `) || title === CLAUDE_IDLE) {
    return true
  }
  // Why: ". " (working) and "* " (idle) are Claude Code title conventions.
  // Other supported agents do not use them, and rejecting titles that mention
  // another agent in the task text caused false negatives for real Claude tabs.
  if (title.startsWith('. ') || title.startsWith('* ')) {
    return true
  }
  if (containsAgentSpinnerGlyph(title)) {
    // Why: OpenClaude titles carry the same spinner frames but are not Claude.
    return !lower.includes('openclaude')
  }
  // Why: permission/action-required Claude titles can omit the usual prefixes.
  // Token-match so cwd/worktree titles like "claude-scratch" do not become
  // Claude tabs, while task text that merely mentions Claude still stays out.
  const trimmedTitle = title.trimStart()
  if (
    trimmedTitle.toLowerCase().startsWith('claude') &&
    titleHasAgentName(trimmedTitle, 'claude')
  ) {
    return true
  }

  return false
}

/** Pure in `title` — memoized so repeated selector reads skip the regex ladder. */
export const isClaudeAgent: (title: string) => boolean =
  memoizeTitleClassification(computeIsClaudeAgent)

export function isClaudeManagementTitle(title: string): boolean {
  return CLAUDE_MANAGEMENT_TITLE_RE.test(title)
}

function computeAgentLabel(title: string): string | null {
  if (isClaudeManagementTitle(title)) {
    return null
  }
  // Why: the native marker owns the whole title; its session text may name or
  // include status glyphs from other agents without changing OpenCode identity.
  if (isOpenCodeNativeTitle(title)) {
    return 'OpenCode'
  }
  // Why: Claude Code title text is often the task title. If that task mentions
  // another CLI, the Claude-specific prefix is the identity signal, not the words.
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
  // Why: Pi working titles include a braille spinner prefix, which would be
  // mistaken for Claude Code if we checked `isClaudeAgent` first.
  if (isPiAgentTitle(title)) {
    return 'Pi'
  }
  // Why: Codex/OpenCode can also use braille spinner prefixes while
  // working. Prefer explicit name matches before Claude's generic spinner
  // heuristic so mixed-agent hovercards stay truthful. Token-match (not
  // substring) so cwd/worktree titles like "opencode-blinker" don't mint a
  // false agent identity.
  if (titleHasAgentName(title, 'codex')) {
    return 'Codex'
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

const TITLE_LABEL_TO_AGENT: Partial<Record<string, TuiAgent>> = {
  'Claude Code': 'claude',
  Codex: 'codex',
  OpenCode: 'opencode',
  Pi: 'pi'
}

function hasGenericClaudeStatusPrefix(title: string): boolean {
  return (
    containsAgentSpinnerGlyph(title) ||
    title.startsWith('✳ ') ||
    title === '✳' ||
    title.startsWith('. ') ||
    title.startsWith('* ')
  )
}

export { isClaudeIdentityFrameTitle } from './agent-title-core'

function isGenericClaudeStatusClaim(title: string, titleAgent: TuiAgent | null): boolean {
  return (
    titleAgent === 'claude' &&
    hasGenericClaudeStatusPrefix(title) &&
    !titleHasAgentName(title, 'claude')
  )
}

export function resolveTerminalTitleAgentType(title: string): TuiAgent | null {
  const label = getAgentLabel(title)
  const parsed = label ? (TITLE_LABEL_TO_AGENT[label] ?? null) : null
  return resolveCanonicalPaneAgentIdentity({
    title,
    // Preserve this public title-parser adapter's historical answer; pane identity
    // consumers pass raw titles to the canonical resolver and enforce its fence.
    uncoveredFallback: { agent: parsed, titleOnly: false }
  }).agent
}

/**
 * Resolve a terminal title's agent identity, but treat Claude's bare status
 * prefixes (spinner / "✳" / ". " / "* ") as activity-only. They are evidence
 * that something is running, not proof the agent is Claude — so a task or
 * worktree title cannot become Claude without an explicit "Claude Code" name.
 */
function computeExplicitTerminalTitleAgentType(title: string): TuiAgent | null {
  const titleAgent = resolveTerminalTitleAgentType(title)
  if (isGenericClaudeStatusClaim(title, titleAgent)) {
    return null
  }
  return titleAgent
}

/** Pure in `title` — memoized so repeated selector reads skip the canonical/title parse. */
export const resolveExplicitTerminalTitleAgentType: (title: string) => TuiAgent | null =
  memoizeTitleClassification(computeExplicitTerminalTitleAgentType)
