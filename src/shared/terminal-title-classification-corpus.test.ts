import { describe, expect, it } from 'vitest'
import { getAgentLabel, isClaudeAgent } from './agent-title-identity'
import { detectAgentStatusFromTitle } from './agent-title-status'
import { TERMINAL_TITLE_CLASSIFICATION_CORPUS } from './terminal-title-classification-corpus'
import {
  getAgentLabel as getExplicitAgentLabel,
  isClaudeAgent as isExplicitClaudeAgent,
  resolveExplicitTerminalTitleAgentType,
  resolveTerminalTitleAgentType
} from './terminal-title-agent-type'

/**
 * Pins the exact verdict every title classifier returns for a realistic corpus.
 *
 * Why: these classifiers are now memoized on the title string, and a caching bug
 * here would repaint a pane under the wrong agent. This table is the proof that
 * memoization is transparent — it was generated from the pre-memo implementation
 * and must keep matching byte-for-byte.
 */
type PinnedRow = [
  title: string,
  status: string | null,
  label: string | null,
  claude: boolean,
  explicitLabel: string | null,
  explicitClaude: boolean,
  titleAgent: string | null,
  explicitTitleAgent: string | null
]

const PINNED_CLASSIFICATIONS: readonly PinnedRow[] = [
  ['', null, null, false, null, false, null, null],
  ['zsh', null, null, false, null, false, null, null],
  ['bash', null, null, false, null, false, null, null],
  ['nwparker@mac: ~/orca', null, null, false, null, false, null, null],
  ['npm run dev', null, null, false, null, false, null, null],
  ['opencode-blinker', null, null, false, null, false, null, null],
  ['openclaude', null, null, false, null, false, null, null],
  ['openclaude-scratch', null, null, false, null, false, null, null],
  ['claude-scratch', null, null, false, null, false, null, null],
  ['~/opencode/ready', null, null, false, null, false, null, null],
  ['review-14600-opencode', null, null, false, null, false, null, null],
  ['timestamp ready', null, null, false, null, false, null, null],
  ['C:\\tools\\opencode\\run', null, null, false, null, false, null, null],
  ['/usr/local/bin/claude/notes', null, null, false, null, false, null, null],
  ['opencode.exe', 'idle', 'OpenCode', false, 'OpenCode', false, 'opencode', 'opencode'],
  ['openclaude.cmd', null, null, false, null, false, null, null],
  ['claude.bat working', 'working', 'Claude Code', true, 'Claude Code', true, 'claude', 'claude'],
  ['\u2733', 'idle', 'Claude Code', true, 'Claude Code', true, 'claude', null],
  ['\u2733 Claude Code', 'idle', 'Claude Code', true, 'Claude Code', true, 'claude', 'claude'],
  ['\u2733 ready', 'idle', 'Claude Code', true, 'Claude Code', true, 'claude', null],
  ['. building the parser', null, 'Claude Code', true, 'Claude Code', true, 'claude', null],
  ['* done', null, 'Claude Code', true, 'Claude Code', true, 'claude', null],
  ['Claude Code', 'idle', 'Claude Code', true, 'Claude Code', true, 'claude', 'claude'],
  [
    'claude - action required',
    'permission',
    'Claude Code',
    true,
    'Claude Code',
    true,
    'claude',
    'claude'
  ],
  ['Claude ready', 'idle', 'Claude Code', true, 'Claude Code', true, 'claude', 'claude'],
  ['claude agents', null, null, false, null, false, null, null],
  ['"/usr/local/bin/claude" agents', null, null, false, null, false, null, null],
  ['\u280b Claude Code', 'working', 'Claude Code', true, 'Claude Code', true, 'claude', 'claude'],
  [
    '\u2809 OpenCode \u2014 refactoring',
    'working',
    'OpenCode',
    true,
    'OpenCode',
    true,
    'opencode',
    'opencode'
  ],
  ['\u25d0 working', 'working', 'Claude Code', true, 'Claude Code', true, 'claude', null],
  ['\u280b OpenClaude', 'working', null, false, null, false, null, null],
  ['opencode working', 'working', 'OpenCode', false, 'OpenCode', false, 'opencode', 'opencode'],
  ['opencode ready', 'idle', 'OpenCode', false, 'OpenCode', false, 'opencode', 'opencode'],
  ['\u03c0 > session - ~/orca', 'idle', 'Pi', false, 'Pi', false, 'pi', 'pi'],
  ['\u03c0 ! blocked-session', 'permission', 'Pi', false, 'Pi', false, 'pi', 'pi'],
  ['\u280b \u03c0 - session - ~/orca', 'working', 'Pi', true, 'Pi', true, 'pi', 'pi'],
  ['zsh | \u280b OpenCode', 'working', 'OpenCode', true, 'OpenCode', true, 'opencode', 'opencode'],
  ['tmux | claude - action required', 'permission', null, false, null, false, null, null],
  [
    'ssh host | opencode ready',
    'idle',
    'OpenCode',
    false,
    'OpenCode',
    false,
    'opencode',
    'opencode'
  ]
]

describe('terminal title classification', () => {
  it('covers every corpus title exactly once', () => {
    expect(PINNED_CLASSIFICATIONS.map(([title]) => title)).toEqual([
      ...TERMINAL_TITLE_CLASSIFICATION_CORPUS
    ])
  })

  it.each(PINNED_CLASSIFICATIONS)(
    'classifies %j identically',
    (
      title,
      status,
      label,
      claude,
      explicitLabel,
      explicitClaude,
      titleAgent,
      explicitTitleAgent
    ) => {
      expect(detectAgentStatusFromTitle(title)).toBe(status)
      expect(getAgentLabel(title)).toBe(label)
      expect(isClaudeAgent(title)).toBe(claude)
      expect(getExplicitAgentLabel(title)).toBe(explicitLabel)
      expect(isExplicitClaudeAgent(title)).toBe(explicitClaude)
      expect(resolveTerminalTitleAgentType(title)).toBe(titleAgent)
      expect(resolveExplicitTerminalTitleAgentType(title)).toBe(explicitTitleAgent)
    }
  )

  it('returns the same verdict on the second read of every title', () => {
    for (const title of TERMINAL_TITLE_CLASSIFICATION_CORPUS) {
      expect(detectAgentStatusFromTitle(title)).toBe(detectAgentStatusFromTitle(title))
      expect(getAgentLabel(title)).toBe(getAgentLabel(title))
      expect(resolveExplicitTerminalTitleAgentType(title)).toBe(
        resolveExplicitTerminalTitleAgentType(title)
      )
    }
  })
})
