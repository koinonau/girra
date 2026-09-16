import { describe, expect, it } from 'vitest'
import { detectTerminalWaitBlockedReason } from './terminal-wait-detection'
import { buildTerminalWaitText } from './terminal-wait-tail-state'

// Why these shapes: agents working on Girra print `rg` hits from this very detector and its
// specs, so quoted prompt wording lands in scrollback while the terminal sits at its input box.
const QUOTED_DETECTOR_SOURCE_LINE =
  "└   if (hooksindex !== -1 && normalized.includes('press enter to confirm', hooksindex)) {"
const QUOTED_PERMISSION_FIXTURE_LINE =
  "  └ 236:      'Permission required\\nThis command requires permission\\nAllow once\\nAllow always\\nReject\\n',"

function agentIdleScreen(): string[] {
  return [
    '• Done. The detector bounding is in place and the suite passes.',
    '',
    '> Try "refactor this function"',
    '',
    '  claude-opus medium · ~/orca/workspaces/orca/fix-wait-detector-scrollback'
  ]
}

function agentScrollback(quotedLines: string[], trailingLineCount: number): string[] {
  const lines: string[] = [
    '• Explored',
    '  └ Search press enter to confirm in src/main/runtime',
    '    Read terminal-wait-detection.ts',
    '',
    '• Ran rg -n "press enter to confirm" src/main/runtime/terminal-wait-detection.ts src/main/runtime/orca-runtime-tests/agent-status-and-waits.spec.ts',
    '  └ src/main/runtime/terminal-wait-detection.ts',
    '    src/main/runtime/orca-runtime-tests/agent-status-and-waits.spec.ts',
    '    src/main/runtime/orca-runtime-tests/terminal-creation-and-readiness-part-07.spec.ts',
    ...quotedLines
  ]
  for (let index = 0; index < trailingLineCount; index += 1) {
    lines.push(`    ${index}: unrelated agent narration about hook wiring and sandbox policy`)
  }
  return lines
}

function waitTextFor(lines: string[]): string {
  return buildTerminalWaitText(lines, '', '')
}

describe('detectTerminalWaitBlockedReason scrollback bounding', () => {
  it('ignores detector source quoted by rg output far above an idle agent input box', () => {
    const waitText = waitTextFor([
      ...agentScrollback([QUOTED_DETECTOR_SOURCE_LINE], 300),
      ...agentIdleScreen()
    ])

    expect(waitText).toContain('press enter to confirm')
    expect(detectTerminalWaitBlockedReason(waitText)).toBeNull()
  })

  it('ignores a quoted permission fixture in scrollback above an idle agent input box', () => {
    const waitText = waitTextFor([
      ...agentScrollback([QUOTED_PERMISSION_FIXTURE_LINE], 300),
      ...agentIdleScreen()
    ])

    expect(waitText.toLowerCase()).toContain('allow once')
    expect(detectTerminalWaitBlockedReason(waitText)).toBeNull()
  })

  it('ignores quoted prompt wording just above the live-dialog window', () => {
    // Why 10: with the 3-line idle screen the quoted lines sit 13-14 non-blank lines from the bottom.
    const waitText = waitTextFor([
      ...agentScrollback([QUOTED_DETECTOR_SOURCE_LINE, QUOTED_PERMISSION_FIXTURE_LINE], 10),
      ...agentIdleScreen()
    ])

    expect(detectTerminalWaitBlockedReason(waitText)).toBeNull()
  })
})

// Real dialog text: terminal-creation-and-readiness-part-07.spec.ts and agent-status-and-waits.spec.ts.
const LIVE_AGENT_PROMPTS: { name: string; lines: string[]; reason: string }[] = [
  {
    name: 'hooks review',
    lines: [
      'Hooks need review',
      '2 hooks are new or changed.',
      '1. Review hooks',
      '2. Trust all and continue',
      'Press enter to confirm or esc to go back'
    ],
    reason: 'agent-hooks-review-prompt'
  },
  {
    name: 'trust workspace',
    lines: ['Do you trust this workspace directory?', '1. Yes', '2. No'],
    reason: 'agent-trust-workspace'
  },
  {
    name: 'update',
    lines: [
      'Update available! 0.131.0 -> 0.132.0',
      '1. Update now',
      '2. Skip',
      'Press enter to continue'
    ],
    reason: 'agent-update-prompt'
  },
  {
    name: 'cwd selection',
    lines: [
      'Choose working directory to resume this session',
      '  Session = latest cwd recorded in the resumed session',
      '  Current = your current working directory',
      '  Press enter to continue'
    ],
    reason: 'agent-cwd-prompt'
  },
  {
    name: 'grant permissions',
    lines: [
      'Would you like to grant these permissions?',
      '1. Yes, grant these permissions for this turn',
      '2. No, continue without permissions',
      'Press enter to confirm or esc to cancel'
    ],
    reason: 'agent-interactive-prompt'
  },
  {
    name: 'permission required',
    lines: [
      'Permission required',
      'This command requires permission',
      'Allow once',
      'Allow always',
      'Reject'
    ],
    reason: 'agent-interactive-prompt'
  }
]

describe('detectTerminalWaitBlockedReason live prompts', () => {
  for (const prompt of LIVE_AGENT_PROMPTS) {
    it(`still blocks on a live ${prompt.name} prompt after long scrollback`, () => {
      const waitText = waitTextFor([
        ...agentScrollback([QUOTED_DETECTOR_SOURCE_LINE, QUOTED_PERMISSION_FIXTURE_LINE], 300),
        ...prompt.lines
      ])

      expect(detectTerminalWaitBlockedReason(waitText)).toBe(prompt.reason)
    })

    it(`blocks on a live ${prompt.name} prompt rendered with blank spacer rows`, () => {
      // Why: the visible-screen probe joins raw rows, so blank rows between dialog lines must not eat the window.
      const spaced = prompt.lines.flatMap((line) => [line, '', ''])
      const screen = [
        ' Claude Code v2.1.0',
        '',
        ...spaced,
        '',
        '  claude-opus medium · ~/orca/workspaces/orca/fix-wait-detector-scrollback',
        ''
      ].join('\n')

      expect(detectTerminalWaitBlockedReason(screen)).toBe(prompt.reason)
    })
  }

  it('reports the newest prompt when a live dialog follows a stale one at the bottom', () => {
    const waitText = waitTextFor([
      'Update available! 0.131.0 -> 0.132.0',
      'Press enter to continue',
      ' Claude Code v2.1.0',
      ' ~/orca/workspaces/orca/cli-debug',
      'Hooks need review',
      'Press enter to confirm'
    ])

    expect(detectTerminalWaitBlockedReason(waitText)).toBe('agent-hooks-review-prompt')
  })
})

// Why: these matchers never inspect the pane's agent, so an agent-named reason would reach the user
// verbatim through the CLI and the worker receipt's "Agent startup blocked:" line.
describe('detectTerminalWaitBlockedReason agent-neutral reasons', () => {
  const AGENT_PROMPTS: { name: string; lines: string[]; reason: string }[] = [
    {
      name: 'an OpenCode workspace trust dialog',
      lines: [
        'OpenCode 1.0.3',
        'Do you trust the files in this folder?',
        '1. Yes, I trust this folder',
        '2. No, exit'
      ],
      reason: 'agent-trust-workspace'
    },
    {
      name: 'a Claude Code trusted-workspace dialog',
      lines: [
        'Claude Code',
        'Trusted workspace?',
        'This directory has not been opened before.',
        '1. Yes, proceed',
        '2. No, exit'
      ],
      reason: 'agent-trust-workspace'
    },
    {
      name: 'an OpenCode update banner',
      lines: [
        'OpenCode',
        'Update available! 1.4.0 -> 1.5.0',
        '1. Update now',
        '2. Skip',
        'Press enter to continue'
      ],
      reason: 'agent-update-prompt'
    },
    {
      name: 'a Pi permission dialog',
      lines: [
        'Pi',
        'Permission required',
        'Running this tool requires permission',
        'Allow once',
        'Allow always',
        'Reject'
      ],
      reason: 'agent-interactive-prompt'
    },
    {
      name: 'a Claude Code hooks review dialog',
      lines: [
        'Claude Code',
        'Hooks need review',
        'PreToolUse:Bash  .claude/hooks/guard.sh',
        'Press enter to confirm'
      ],
      reason: 'agent-hooks-review-prompt'
    },
    {
      name: 'an OpenCode sandbox confirmation',
      lines: [
        'OpenCode 1.0.3',
        'This action runs outside the sandbox.',
        'Press enter to confirm or esc to go back'
      ],
      reason: 'agent-interactive-prompt'
    }
  ]

  for (const prompt of AGENT_PROMPTS) {
    it(`reports an agent-neutral reason for ${prompt.name}`, () => {
      expect(detectTerminalWaitBlockedReason(waitTextFor(prompt.lines))).toBe(prompt.reason)
    })
  }
})
