/**
 * Token-matching for agent names inside terminal titles.
 *
 * Why a dedicated module: agent names must be matched as whole tokens, never as
 * substrings. Substring matching mis-fired on worktree/cwd titles like
 * "opencode-blinker" (⊃ "opencode") or "openclaude" (⊃ "claude"), painting a
 * tab as the wrong agent whenever the title fell back to the
 * bare directory name. The boundary guard `(?<![\w./\\-])…(?![\w./\\-])` rejects
 * path separators (POSIX and Windows) and hyphenated compounds on both sides.
 */

// Why: for OSC-title detection only. Intentionally narrower than the full set
// of launchable agents because short names like "amp" would classify ordinary
// shell titles like "timestamp ready" as agent activity.
export const AGENT_NAMES = ['claude', 'opencode']

// Why: Windows agent titles can surface launcher process names such as
// `claude.exe`; still reject arbitrary dotted path fragments.
const WINDOWS_EXECUTABLE_SUFFIX_RE = String.raw`(?:\.(?:exe|cmd|bat|ps1))`

export function buildAgentNameRe(name: string): RegExp {
  return new RegExp(
    `(?<![\\w./\\\\-])${name}(?:${WINDOWS_EXECUTABLE_SUFFIX_RE})?(?![\\w./\\\\-])`,
    'i'
  )
}

const AGENT_NAME_RE_BY_NAME = new Map(AGENT_NAMES.map((name) => [name, buildAgentNameRe(name)]))

const ANY_LEGACY_AGENT_NAME_RE = new RegExp(
  AGENT_NAMES.map(
    (name) => `(?<![\\w./\\\\-])${name}(?:${WINDOWS_EXECUTABLE_SUFFIX_RE})?(?![\\w./\\\\-])`
  ).join('|'),
  'i'
)

/** True when `title` contains `name` (a member of AGENT_NAMES) as a whole token. */
export function titleHasAgentName(title: string, name: string): boolean {
  return AGENT_NAME_RE_BY_NAME.get(name)?.test(title) ?? false
}

/** True when `title` contains any AGENT_NAMES entry as a whole token. */
export function titleHasAnyLegacyAgentName(title: string): boolean {
  return ANY_LEGACY_AGENT_NAME_RE.test(title)
}
