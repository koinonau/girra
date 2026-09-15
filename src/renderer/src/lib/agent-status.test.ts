import { describe, expect, it, test, vi } from 'vitest'
import {
  detectAgentStatusFromTitle,
  clearWorkingIndicators,
  createAgentStatusTracker,
  getAgentLabel,
  isClaudeAgent,
  isClaudeManagementTitle,
  normalizeTerminalTitle,
  isExplicitAgentStatusFresh,
  mapAgentStatusStateToVisualStatus,
  formatAgentTypeLabel,
  agentTypeToIconAgent
} from './agent-status'
import { extractLastOscTitle } from '../components/terminal-pane/pty-transport'

describe('detectAgentStatusFromTitle', () => {
  it('returns null for empty string', () => {
    expect(detectAgentStatusFromTitle('')).toBeNull()
  })

  it('returns null for a title with no agent indicators', () => {
    expect(detectAgentStatusFromTitle('bash')).toBeNull()
    expect(detectAgentStatusFromTitle('vim myfile.ts')).toBeNull()
  })

  // --- Braille spinner characters ---
  it('detects braille spinner ⠋ as working', () => {
    expect(detectAgentStatusFromTitle('⠋ Codex is thinking')).toBe('working')
  })

  it('detects braille spinner ⠙ as working', () => {
    expect(detectAgentStatusFromTitle('⠙ some task')).toBe('working')
  })

  it('detects braille spinner ⠹ as working', () => {
    expect(detectAgentStatusFromTitle('⠹ opencode running')).toBe('working')
  })

  it('detects braille spinner ⠸ as working', () => {
    expect(detectAgentStatusFromTitle('⠸ process')).toBe('working')
  })

  it('detects braille spinner ⠼ as working', () => {
    expect(detectAgentStatusFromTitle('⠼ opencode')).toBe('working')
  })

  it('detects braille spinner ⠴ as working', () => {
    expect(detectAgentStatusFromTitle('⠴ loading')).toBe('working')
  })

  it('detects braille spinner ⠦ as working', () => {
    expect(detectAgentStatusFromTitle('⠦ claude')).toBe('working')
  })

  it('detects braille spinner ⠧ as working', () => {
    expect(detectAgentStatusFromTitle('⠧ task')).toBe('working')
  })

  // --- Agent name keyword combos ---
  it('detects permission requests from agent titles', () => {
    expect(detectAgentStatusFromTitle('Claude Code - action required')).toBe('permission')
  })

  it('detects "permission" keyword with agent name', () => {
    expect(detectAgentStatusFromTitle('codex - permission needed')).toBe('permission')
  })

  it('detects "waiting" keyword with agent name', () => {
    expect(detectAgentStatusFromTitle('opencode waiting for input')).toBe('permission')
  })

  it('detects "ready" keyword as idle', () => {
    expect(detectAgentStatusFromTitle('claude ready')).toBe('idle')
  })

  it('detects "idle" keyword as idle', () => {
    expect(detectAgentStatusFromTitle('codex idle')).toBe('idle')
  })

  it('detects "done" keyword as idle', () => {
    expect(detectAgentStatusFromTitle('opencode done')).toBe('idle')
  })

  it('detects "working" keyword as working', () => {
    expect(detectAgentStatusFromTitle('claude working on task')).toBe('working')
  })

  it('detects "thinking" keyword as working', () => {
    expect(detectAgentStatusFromTitle('codex thinking')).toBe('working')
  })

  it('detects "running" keyword as working', () => {
    expect(detectAgentStatusFromTitle('opencode running tests')).toBe('working')
  })

  // --- Claude Code title prefixes ---
  it('detects ". " prefix as working (Claude Code)', () => {
    expect(detectAgentStatusFromTitle('. claude')).toBe('working')
  })

  it('detects "* " prefix as idle (Claude Code)', () => {
    expect(detectAgentStatusFromTitle('* claude')).toBe('idle')
  })

  // --- Real Claude Code OSC titles ---
  // Claude Code sets title to task description, NOT "Claude Code"
  it('detects ✳ prefix as idle (Claude Code with task description)', () => {
    expect(detectAgentStatusFromTitle('✳ User acknowledgment and confirmation')).toBe('idle')
  })

  it('detects ✳ prefix as idle (Claude Code with agent name)', () => {
    expect(detectAgentStatusFromTitle('✳ Claude Code')).toBe('idle')
  })

  it('detects braille spinner as working (Claude Code with task description)', () => {
    expect(detectAgentStatusFromTitle('⠐ User acknowledgment and confirmation')).toBe('working')
  })

  it('detects braille spinner as working (Claude Code with agent name)', () => {
    expect(detectAgentStatusFromTitle('⠂ Claude Code')).toBe('working')
  })

  // --- Agent name alone defaults to idle ---
  it('returns idle for bare agent name "claude"', () => {
    expect(detectAgentStatusFromTitle('claude')).toBe('idle')
  })

  it('returns idle for bare agent name "codex"', () => {
    expect(detectAgentStatusFromTitle('codex')).toBe('idle')
  })

  it('returns idle for bare agent name "opencode"', () => {
    expect(detectAgentStatusFromTitle('opencode')).toBe('idle')
  })

  it('does not read OpenClaude titles as Claude activity', () => {
    expect(detectAgentStatusFromTitle('OpenClaude ready')).toBeNull()
    expect(detectAgentStatusFromTitle('OpenClaude - action required')).toBeNull()
  })

  it('excludes the exact Claude agents management title', () => {
    expect(detectAgentStatusFromTitle('claude agents')).toBeNull()
    expect(detectAgentStatusFromTitle('  Claude Agents  ')).toBeNull()
    expect(detectAgentStatusFromTitle('claude.exe agents')).toBeNull()
    expect(detectAgentStatusFromTitle('Claude.CMD agents')).toBeNull()
    expect(detectAgentStatusFromTitle('claude.bat agents')).toBeNull()
    expect(detectAgentStatusFromTitle('Claude.PS1 agents')).toBeNull()
    expect(
      detectAgentStatusFromTitle('C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd agents')
    ).toBeNull()
    expect(
      detectAgentStatusFromTitle('"C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd" agents')
    ).toBeNull()
    expect(detectAgentStatusFromTitle('claude agents working')).toBe('working')
  })

  it('detects Pi idle titles', () => {
    expect(detectAgentStatusFromTitle('π - my-project')).toBe('idle')
    expect(detectAgentStatusFromTitle('π - session-name - my-project')).toBe('idle')
  })

  // --- Case insensitivity ---
  it('is case-insensitive for agent names', () => {
    expect(detectAgentStatusFromTitle('CLAUDE')).toBe('idle')
    expect(detectAgentStatusFromTitle('Codex Working')).toBe('working')
  })

  // Why: `containsAgentName` token-matches, so cwd-path fragments like "~/codex-scratch" no longer mint an 'idle' agent signal.
  it('does not treat cwd-path agent-name fragments as agent activity', () => {
    expect(detectAgentStatusFromTitle('~/codex-scratch')).toBeNull()
    expect(detectAgentStatusFromTitle('~/codex already built')).toBeNull()
    expect(detectAgentStatusFromTitle('opencode-blinker')).toBeNull()
    expect(detectAgentStatusFromTitle('claude-scratch')).toBeNull()
  })

  // Why: short agent names are unsafe under substring detection; don't add aliases that turn "timestamp ready" into agent activity.
  it('does not treat ordinary words containing "amp" as agent titles', () => {
    expect(detectAgentStatusFromTitle('timestamp ready')).toBeNull()
    expect(detectAgentStatusFromTitle('clamp working')).toBeNull()
    expect(detectAgentStatusFromTitle('example permission needed')).toBeNull()
  })
})

// Why: regression guard — a path fragment like `~/codex/working` must never classify as 'working' (path separators aren't word boundaries).
describe('detectAgentStatusFromTitle path-separator rejection', () => {
  test('rejects working keywords adjacent to POSIX path separators', () => {
    expect(detectAgentStatusFromTitle('~/codex/working')).not.toBe('working')
    expect(detectAgentStatusFromTitle('~/codex/thinking')).not.toBe('working')
    expect(detectAgentStatusFromTitle('~/codex/running')).not.toBe('working')
  })

  test('rejects working keywords adjacent to Windows path separators', () => {
    expect(detectAgentStatusFromTitle('C:\\codex\\working')).not.toBe('working')
    expect(detectAgentStatusFromTitle('C:\\opencode\\thinking')).not.toBe('working')
  })

  test('rejects working keywords adjacent to `.` separators', () => {
    expect(detectAgentStatusFromTitle('codex.working')).not.toBe('working')
    expect(detectAgentStatusFromTitle('opencode.thinking')).not.toBe('working')
  })

  test('still accepts legitimate idle/working titles separated by whitespace', () => {
    expect(detectAgentStatusFromTitle('Codex done')).toBe('idle')
    expect(detectAgentStatusFromTitle('OpenCode ready')).toBe('idle')
    expect(detectAgentStatusFromTitle('Claude idle')).toBe('idle')
    expect(detectAgentStatusFromTitle('Codex working')).toBe('working')
    expect(detectAgentStatusFromTitle('OpenCode thinking')).toBe('working')
  })

  // Why: block path separators only on the LEFT of the keyword; blocking the right would regress titles ending in `.`/`!`/`?`.
  test('still accepts keywords followed by trailing punctuation', () => {
    expect(detectAgentStatusFromTitle('Codex done.')).toBe('idle')
    expect(detectAgentStatusFromTitle('Claude idle!')).toBe('idle')
    expect(detectAgentStatusFromTitle('OpenCode ready?')).toBe('idle')
    expect(detectAgentStatusFromTitle('Codex working.')).toBe('working')
    expect(detectAgentStatusFromTitle('OpenCode thinking...')).toBe('working')
  })
})

describe('clearWorkingIndicators', () => {
  it('strips Claude Code ". " working prefix', () => {
    const cleared = clearWorkingIndicators('. claude')
    expect(cleared).toBe('claude')
    expect(detectAgentStatusFromTitle(cleared)).not.toBe('working')
  })

  it('strips braille spinner characters and working keywords', () => {
    const cleared = clearWorkingIndicators('⠋ Codex is thinking')
    expect(cleared).toBe('Codex is')
    expect(detectAgentStatusFromTitle(cleared)).not.toBe('working')
  })

  it('returns original title if no working indicators found', () => {
    expect(clearWorkingIndicators('* claude')).toBe('* claude')
    expect(clearWorkingIndicators('Terminal 1')).toBe('Terminal 1')
  })

  // Why: clearWorkingIndicators must use the same hyphen-aware boundary as STRONG_WORKING_KEYWORDS_RE so clearer and detector stay symmetric.
  it('does not strip working keywords inside hyphenated compounds', () => {
    expect(clearWorkingIndicators('codex is-working-cap')).toBe('codex is-working-cap')
    expect(clearWorkingIndicators('claude reworking diff')).toBe('claude reworking diff')
    expect(clearWorkingIndicators('codex overthinking it')).toBe('codex overthinking it')
  })

  it('still strips working keywords at whitespace boundaries', () => {
    const cleared = clearWorkingIndicators('Codex working on tests')
    expect(cleared).not.toMatch(/\bworking\b/)
    expect(detectAgentStatusFromTitle(cleared)).not.toBe('working')
  })
})

describe('normalizeTerminalTitle', () => {
  it('leaves non-Pi titles unchanged', () => {
    expect(normalizeTerminalTitle('⠂ Claude Code')).toBe('⠂ Claude Code')
    expect(normalizeTerminalTitle('bash')).toBe('bash')
  })

  it('preserves Pi titles and canonicalizes only the spinner frame', () => {
    // Only the braille frame churns; the rest is the session name and cwd (#16093).
    expect(normalizeTerminalTitle('⠋ π - my-project')).toBe('⠋ π - my-project')
    expect(normalizeTerminalTitle('⠙ π - my-project')).toBe('⠋ π - my-project')
    expect(normalizeTerminalTitle('π - my-project')).toBe('π - my-project')
    expect(normalizeTerminalTitle('⠋ π: my-project')).toBe('⠋ π: my-project')
    expect(normalizeTerminalTitle('π: my-project')).toBe('π: my-project')
    expect(normalizeTerminalTitle('π -')).toBe('π -')
    expect(normalizeTerminalTitle('π:')).toBe('π:')
    expect(normalizeTerminalTitle('π ')).toBe('π ')
  })
})

describe('getAgentLabel', () => {
  it('labels Pi working titles as Pi instead of Claude Code', () => {
    expect(getAgentLabel('⠋ π - my-project')).toBe('Pi')
  })

  it('treats Claude Code prefixed task titles as Claude even when they mention another CLI', () => {
    expect(getAgentLabel('✳ OpenCode ready')).toBe('Claude Code')
    expect(getAgentLabel('. Compare Opencode Vs Orca')).toBe('Claude Code')
    expect(getAgentLabel('* Review Codex behavior')).toBe('Claude Code')
  })

  it('labels supported agent families consistently', () => {
    expect(getAgentLabel('⠂ Claude Code')).toBe('Claude Code')
    expect(getAgentLabel('⠋ Codex is thinking')).toBe('Codex')
    expect(getAgentLabel('OpenCode running')).toBe('OpenCode')
    expect(getAgentLabel('⠋ OpenClaude')).toBeNull()
  })

  it('does not label the Claude agents management title', () => {
    expect(getAgentLabel('claude agents')).toBeNull()
  })

  // Why: substring matching mislabeled cwd/worktree name fragments (e.g. "opencode-blinker") as agents; token-match to reject them.
  it('does not label cwd/worktree path fragments as an agent', () => {
    expect(getAgentLabel('opencode-blinker')).toBeNull()
    expect(getAgentLabel('claude-scratch')).toBeNull()
    expect(getAgentLabel('~/projects/codex-scratch')).toBeNull()
    expect(getAgentLabel('~/cursor-rules')).toBeNull()
    expect(getAgentLabel('pi-fixtures')).toBeNull()
  })

  it('still labels real agent titles that contain the name as a token', () => {
    expect(getAgentLabel('OpenCode ready')).toBe('OpenCode')
    expect(getAgentLabel('claude.exe')).toBe('Claude Code')
    expect(getAgentLabel('⠋ Codex')).toBe('Codex')
    expect(getAgentLabel('opencode.cmd working')).toBe('OpenCode')
  })

  // Why: "cursor" is ordinary editor vocabulary, so a bare token is not agent identity.
  it('does not label a bare "cursor" token in another agent title', () => {
    expect(getAgentLabel('⠋ preserve cursor visibility across replays')).toBe('Claude Code')
    expect(getAgentLabel('⠋ Codex: fix cursor offsets')).toBe('Codex')
    expect(getAgentLabel('Terminal Cursor and Orca slows down')).toBeNull()
  })
})

describe('isClaudeAgent', () => {
  it('keeps OpenClaude out of Claude-specific prompt-cache detection', () => {
    expect(isClaudeAgent('⠋ Claude Code')).toBe(true)
    expect(isClaudeAgent('⠋ OpenClaude')).toBe(false)
    expect(isClaudeAgent('OpenClaude ready')).toBe(false)
  })

  // Why: a Claude title merely mentioning a text cursor is still Claude.
  it('counts cursor-mentioning Claude braille titles as Claude', () => {
    expect(isClaudeAgent('⠋ preserve cursor visibility across replays')).toBe(true)
  })

  it('does not classify non-prefix Claude mentions as Claude agent titles', () => {
    expect(isClaudeAgent('ask claude later')).toBe(false)
    expect(getAgentLabel('ask claude later')).toBeNull()
  })

  it('does not classify the Claude agents management title as a Claude agent', () => {
    expect(isClaudeManagementTitle('  Claude Agents  ')).toBe(true)
    expect(isClaudeManagementTitle('claude.exe agents')).toBe(true)
    expect(isClaudeManagementTitle('claude.cmd agents')).toBe(true)
    expect(isClaudeManagementTitle('claude.bat agents')).toBe(true)
    expect(isClaudeManagementTitle('claude.ps1 agents')).toBe(true)
    expect(
      isClaudeManagementTitle('C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd agents')
    ).toBe(true)
    expect(
      isClaudeManagementTitle('"C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd" agents')
    ).toBe(true)
    expect(isClaudeAgent('claude agents')).toBe(false)
  })
})

describe('createAgentStatusTracker', () => {
  // --- Claude Code: real captured OSC title sequence (v2.1.86) ---
  // Claude Code sets the title to the TASK DESCRIPTION, not "Claude Code"; ✳ prefix is the only reliable idle indicator.
  it('fires on Claude Code working → idle (real captured titles)', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    // Exact sequence captured from Claude Code v2.1.86 via script(1)
    tracker.handleTitle('✳ Claude Code') // startup idle
    expect(onBecameIdle).not.toHaveBeenCalled()

    tracker.handleTitle('⠂ Claude Code') // working
    expect(onBecameIdle).not.toHaveBeenCalled()

    tracker.handleTitle('⠐ Claude Code') // still working
    expect(onBecameIdle).not.toHaveBeenCalled()

    // Claude Code changes title to task description mid-stream!
    tracker.handleTitle('⠐ User acknowledgment and confirmation') // working
    expect(onBecameIdle).not.toHaveBeenCalled()

    tracker.handleTitle('⠂ User acknowledgment and confirmation') // working
    expect(onBecameIdle).not.toHaveBeenCalled()

    tracker.handleTitle('✳ User acknowledgment and confirmation') // done → idle
    expect(onBecameIdle).toHaveBeenCalledTimes(1)
  })

  // --- Codex: braille spinner working, bare name idle ---
  it('fires on Codex working → idle', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('⠋ Codex is thinking') // working
    tracker.handleTitle('codex') // idle (bare name)
    expect(onBecameIdle).toHaveBeenCalledTimes(1)
  })

  it('fires on Pi working → idle', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('⠋ π - my-project')
    tracker.handleTitle('π - my-project')
    expect(onBecameIdle).toHaveBeenCalledTimes(1)
  })

  // --- Multiple cycles ---
  it('fires on each working → idle cycle', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    // Cycle 1
    tracker.handleTitle('⠂ Fix login bug')
    tracker.handleTitle('✳ Fix login bug')
    expect(onBecameIdle).toHaveBeenCalledTimes(1)

    // Cycle 2
    tracker.handleTitle('⠐ Refactor auth module')
    tracker.handleTitle('✳ Refactor auth module')
    expect(onBecameIdle).toHaveBeenCalledTimes(2)
  })

  // --- Non-agent titles should not interfere ---
  it('ignores non-agent titles without losing working state', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('⠂ Claude Code') // working
    tracker.handleTitle('bash') // non-agent (returns null) — should NOT reset
    tracker.handleTitle('✳ Some task description') // idle → should still fire
    expect(onBecameIdle).toHaveBeenCalledTimes(1)
  })

  it('does not fire on idle → idle', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('✳ Claude Code') // idle
    tracker.handleTitle('✳ Some other task') // still idle
    expect(onBecameIdle).not.toHaveBeenCalled()
  })

  it('does not fire on working → working', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('⠂ Claude Code')
    tracker.handleTitle('⠐ Fix the thing')
    tracker.handleTitle('⠂ Fix the thing')
    expect(onBecameIdle).not.toHaveBeenCalled()
  })

  // Why: reset() clears the working latch so a late/reattach idle title can't fire a phantom notification after teardown.
  it('reset() clears working state so a subsequent idle does not fire onBecameIdle', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    tracker.handleTitle('⠂ Claude Code') // working
    tracker.reset()
    tracker.handleTitle('✳ Claude Code') // idle — must NOT fire after reset
    expect(onBecameIdle).not.toHaveBeenCalled()
  })

  // --- End-to-end: raw OSC bytes → extractLastOscTitle → tracker ---
  it('end-to-end: extracts OSC title and detects Claude Code transition', () => {
    const onBecameIdle = vi.fn()
    const tracker = createAgentStatusTracker(onBecameIdle)

    // Real title patterns: task description, NOT "Claude Code"
    const oscTitle = (title: string): string => `\x1b]0;${title}\x07`

    const chunks = [
      `some output${oscTitle('✳ Claude Code')}more output`,
      `data${oscTitle('⠂ Claude Code')}stuff`,
      `response text${oscTitle('⠐ Fix the login bug')}more`,
      `final output${oscTitle('✳ Fix the login bug')}done`
    ]

    for (const chunk of chunks) {
      const title = extractLastOscTitle(chunk)
      if (title !== null) {
        tracker.handleTitle(title)
      }
    }

    expect(onBecameIdle).toHaveBeenCalledTimes(1)
  })
})

describe('isExplicitAgentStatusFresh', () => {
  it('treats the boundary (now - updatedAt == staleAfterMs) as fresh', () => {
    // Why: uses `<=`, so equality at the boundary stays fresh (not stale one tick before the TTL).
    const staleAfterMs = 60_000
    const now = 1_000_000
    const entry = { updatedAt: now - staleAfterMs }
    expect(isExplicitAgentStatusFresh(entry, now, staleAfterMs)).toBe(true)
  })

  it('treats one millisecond past the boundary as stale', () => {
    const staleAfterMs = 60_000
    const now = 1_000_000
    const entry = { updatedAt: now - staleAfterMs - 1 }
    expect(isExplicitAgentStatusFresh(entry, now, staleAfterMs)).toBe(false)
  })

  it('treats a just-updated entry (now - updatedAt == 0) as fresh', () => {
    const staleAfterMs = 60_000
    const now = 1_000_000
    const entry = { updatedAt: now }
    expect(isExplicitAgentStatusFresh(entry, now, staleAfterMs)).toBe(true)
  })
})

describe('mapAgentStatusStateToVisualStatus', () => {
  it("maps 'working' to 'working'", () => {
    expect(mapAgentStatusStateToVisualStatus('working')).toBe('working')
  })

  it("maps 'blocked' to 'permission'", () => {
    expect(mapAgentStatusStateToVisualStatus('blocked')).toBe('permission')
  })

  it("maps 'waiting' to 'permission'", () => {
    expect(mapAgentStatusStateToVisualStatus('waiting')).toBe('permission')
  })

  it("maps 'done' to 'done'", () => {
    expect(mapAgentStatusStateToVisualStatus('done')).toBe('done')
  })

  it('returns a non-empty string for every valid state', () => {
    for (const state of ['working', 'blocked', 'waiting', 'done'] as const) {
      const visual = mapAgentStatusStateToVisualStatus(state)
      expect(typeof visual).toBe('string')
      expect(visual.length).toBeGreaterThan(0)
    }
  })
})

describe('formatAgentTypeLabel', () => {
  it("returns 'Agent' for null", () => {
    expect(formatAgentTypeLabel(null)).toBe('Agent')
  })

  it("returns 'Agent' for undefined", () => {
    expect(formatAgentTypeLabel(undefined)).toBe('Agent')
  })

  it("returns 'Agent' for 'unknown'", () => {
    expect(formatAgentTypeLabel('unknown')).toBe('Agent')
  })

  it("maps 'claude' to 'Claude'", () => {
    expect(formatAgentTypeLabel('claude')).toBe('Claude')
  })

  it("maps 'openclaude' to 'OpenClaude'", () => {
    expect(formatAgentTypeLabel('openclaude')).toBe('OpenClaude')
  })

  it("maps 'codex' to 'Codex'", () => {
    expect(formatAgentTypeLabel('codex')).toBe('Codex')
  })

  it("maps 'gemini' to 'Gemini'", () => {
    expect(formatAgentTypeLabel('gemini')).toBe('Gemini')
  })

  it("maps 'antigravity' to 'Antigravity'", () => {
    expect(formatAgentTypeLabel('antigravity')).toBe('Antigravity')
  })

  it("maps 'cursor' to 'Cursor'", () => {
    expect(formatAgentTypeLabel('cursor')).toBe('Cursor')
  })

  it("maps 'hermes' to 'Hermes'", () => {
    expect(formatAgentTypeLabel('hermes')).toBe('Hermes')
  })

  it("maps 'command-code' to 'Command Code'", () => {
    expect(formatAgentTypeLabel('command-code')).toBe('Command Code')
  })

  it("maps 'ante' to 'Ante'", () => {
    expect(formatAgentTypeLabel('ante')).toBe('Ante')
  })

  it("maps 'trae' to 'Trae'", () => {
    expect(formatAgentTypeLabel('trae')).toBe('Trae')
  })

  it("maps 'prime-agent' to 'Prime Agent'", () => {
    expect(formatAgentTypeLabel('prime-agent')).toBe('Prime Agent')
  })

  it('passes through arbitrary custom agent names as-is', () => {
    expect(formatAgentTypeLabel('weirdo')).toBe('weirdo')
  })
})

describe('agentTypeToIconAgent', () => {
  it('returns null for null', () => {
    expect(agentTypeToIconAgent(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(agentTypeToIconAgent(undefined)).toBeNull()
  })

  it("returns null for 'unknown'", () => {
    expect(agentTypeToIconAgent('unknown')).toBeNull()
  })

  it("round-trips iconable agent types like 'claude'", () => {
    expect(agentTypeToIconAgent('claude')).toBe('claude')
    expect(agentTypeToIconAgent('openclaude')).toBe('openclaude')
    expect(agentTypeToIconAgent('antigravity')).toBe('antigravity')
    expect(agentTypeToIconAgent('command-code')).toBe('command-code')
    expect(agentTypeToIconAgent('ante')).toBe('ante')
    expect(agentTypeToIconAgent('trae')).toBe('trae')
    expect(agentTypeToIconAgent('prime-agent')).toBe('prime-agent')
  })

  it('returns null for arbitrary non-iconable strings', () => {
    // Why: unknown agentTypes must return null so the caller falls back to a neutral glyph, not a broken icon.
    expect(agentTypeToIconAgent('totally-fake-agent')).toBeNull()
  })
})
