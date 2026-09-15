import {
  BRAILLE_SPINNER_RE,
  CLAUDE_IDLE,
  QUARTER_CIRCLE_SPINNER_RE,
  STRONG_IDLE_KEYWORDS_RE,
  STRONG_WORKING_KEYWORDS_RE,
  STRONG_WORKING_KEYWORDS_RE_GLOBAL,
  containsAgentName,
  containsAgentSpinnerGlyph,
  containsAny,
  containsQuarterCircleSpinner,
  isClaudeManagementTitle,
  isPiAgentTitle,
  isPiTerminalTitle
} from './agent-title-core'
import type { AgentStatus } from './agent-title-core'
import { isOpenCodeNativeTitle } from './opencode-terminal-title'
import {
  getPiCompatibleTitleSeparatorStatus,
  getPiCompatibleSyntheticAgentStatus
} from './pi-compatible-synthetic-title'
import { clearPiStateWorkingMarker, getPiStateTitleStatus } from './pi-state-title-marker'
import { getWrapperTitleSegments } from './terminal-title-wrapper-segments'
import { memoizeTitleClassification } from './terminal-title-classification-memo'

/**
 * Strip working-status indicators so stale exit titles stop reporting working.
 */
export function clearWorkingIndicators(title: string): string {
  // Why: Pi's static working marker survives every strip below, so a stale native
  // title would keep re-arming the 3s clear timer without ever leaving working (#13890).
  const clearedPiStateMarker = clearPiStateWorkingMarker(title)
  if (clearedPiStateMarker) {
    return clearedPiStateMarker
  }

  let cleaned = title

  cleaned = cleaned.replace(BRAILLE_SPINNER_RE, '')
  cleaned = cleaned.replace(QUARTER_CIRCLE_SPINNER_RE, '')
  if (cleaned.startsWith('. ')) {
    cleaned = cleaned.slice(2)
  }
  if (containsAgentName(cleaned)) {
    cleaned = cleaned.replace(STRONG_WORKING_KEYWORDS_RE_GLOBAL, '')
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned || title
}

/**
 * Tracks agent status transitions from terminal title changes.
 */
export function createAgentStatusTracker(
  onBecameIdle: (title: string) => void,
  onBecameWorking?: () => void,
  onAgentExited?: () => void,
  initialTitle?: string
): {
  handleTitle: (title: string) => void
  seedTitle: (title: string) => void
  restoreLastExit: (confirmedStatus?: AgentStatus) => AgentStatus | null
  reset: () => void
} {
  // Why: trackers restored mid-session need a last-known status without firing
  // callbacks, or a hidden working agent can miss its later idle transition.
  let lastStatus: AgentStatus | null =
    initialTitle !== undefined ? detectAgentStatusFromTitle(initialTitle) : null
  let restorableExitStatus: AgentStatus | null = null

  return {
    handleTitle(title: string): void {
      const newStatus = detectAgentStatusFromTitle(title)
      if (newStatus !== null) {
        restorableExitStatus = null
      }
      if (lastStatus === 'working' && newStatus !== null && newStatus !== 'working') {
        onBecameIdle(title)
      }
      if (lastStatus !== 'working' && newStatus === 'working') {
        onBecameWorking?.()
      }
      // Why: reverting to a plain shell prompt after idle/permission means the
      // agent exited; while working it can just be a transient internal title.
      if (lastStatus !== null && lastStatus !== 'working' && newStatus === null) {
        restorableExitStatus = lastStatus
        lastStatus = null
        onAgentExited?.()
      }
      if (newStatus !== null) {
        lastStatus = newStatus
      }
    },
    seedTitle(title: string): void {
      lastStatus = detectAgentStatusFromTitle(title)
      restorableExitStatus = null
    },
    restoreLastExit(confirmedStatus?: AgentStatus): AgentStatus | null {
      const restoredStatus = confirmedStatus ?? (lastStatus === null ? restorableExitStatus : null)
      if (restoredStatus !== null) {
        lastStatus = restoredStatus
      }
      restorableExitStatus = null
      return restoredStatus
    },
    reset(): void {
      lastStatus = null
      restorableExitStatus = null
    }
  }
}

/**
 * Normalize high-churn agent titles into stable display labels before storage.
 */
export function normalizeTerminalTitle(title: string): string {
  if (!title) {
    return title
  }

  // Why: Pi animate a braille frame every 80ms, so the frame is the churn — but the rest of
  // the title is the session name and cwd the agent chose. Canonicalize the frame in place
  // (it leads in `⠋ π - session - cwd` and sits medially in `π ⠋ label`) and keep everything
  // else; collapsing to a bare "Pi" discarded both the identity and the label (#16093).
  // Why segments: a multiplexer prefixes the pane title (`zsh | ⠋ π - …`), and an anchored
  // match would skip the canonicalization and let the frame churn through (#8032).
  if (getWrapperTitleSegments(title).some(isPiAgentTitle)) {
    return canonicalizeBrailleSpinnerFrame(title)
  }

  return title
}

/** Why: any braille frame reads as the same animation step, so consecutive frames dedupe. */
function canonicalizeBrailleSpinnerFrame(title: string): string {
  let canonical = ''
  for (const char of title) {
    const codePoint = char.codePointAt(0)
    canonical +=
      codePoint !== undefined && codePoint >= 0x2800 && codePoint <= 0x28ff ? '\u280b' : char
  }
  return canonical
}

function computeAgentStatusFromTitle(title: string): AgentStatus | null {
  if (!title || isClaudeManagementTitle(title)) {
    return null
  }
  if (isOpenCodeNativeTitle(title)) {
    return containsAgentSpinnerGlyph(title) ? 'working' : 'idle'
  }

  // Why: Pi's marker is an explicit state protocol, so it wins over the glyph and
  // keyword gates below — its label is free-form cwd/session text that can carry either.
  const piStateStatus = getPiStateTitleStatus(title)
  if (piStateStatus) {
    return piStateStatus
  }

  // Why: resolve synthetic Pi permission/idle labels before the broader
  // Pi and braille-spinner checks below.
  const piCompatibleSyntheticAgentStatus = getPiCompatibleSyntheticAgentStatus(title)
  if (piCompatibleSyntheticAgentStatus) {
    return piCompatibleSyntheticAgentStatus
  }

  if (title.startsWith(`${CLAUDE_IDLE} `) || title === CLAUDE_IDLE) {
    return 'idle'
  }
  // Why: read the state separator before the blanket idle below — `π ! <label>` is a
  // blocked agent, and treating it as idle hides a Pi pane waiting on the user.
  const piCompatibleSeparatorStatus = getPiCompatibleTitleSeparatorStatus(title)
  if (piCompatibleSeparatorStatus) {
    return piCompatibleSeparatorStatus
  }
  if (isPiTerminalTitle(title)) {
    return 'idle'
  }
  if (containsAgentSpinnerGlyph(title)) {
    return 'working'
  }
  if (!containsAgentName(title)) {
    return null
  }
  if (containsAny(title, ['action required', 'permission', 'waiting'])) {
    return 'permission'
  }
  // Why: boundary-aware regexes avoid cwd/path and substring false positives.
  if (STRONG_IDLE_KEYWORDS_RE.test(title)) {
    return 'idle'
  }
  if (STRONG_WORKING_KEYWORDS_RE.test(title)) {
    return 'working'
  }
  if (title.startsWith('. ')) {
    return 'working'
  }
  if (title.startsWith('* ')) {
    return 'idle'
  }

  return 'idle'
}

/**
 * Pure in `title`, so it is memoized on the title string: sidebar/tab selectors
 * re-ask for the same unchanged titles on every store write.
 */
export const detectAgentStatusFromTitle: (title: string) => AgentStatus | null =
  memoizeTitleClassification(computeAgentStatusFromTitle)

/**
 * True when a quarter-circle spinner frame is the only agent evidence a title carries.
 * Any TUI animates those glyphs, so they prove activity, not identity — callers that
 * authorize writes into the pane need independent evidence (STA-4028, regression #13925).
 */
export function isQuarterCircleSpinnerOnlyAgentTitle(title: string | null | undefined): boolean {
  if (!title || !containsQuarterCircleSpinner(title)) {
    return false
  }
  return detectAgentStatusFromTitle(title.replace(QUARTER_CIRCLE_SPINNER_RE, '').trim()) === null
}
