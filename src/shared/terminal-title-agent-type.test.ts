import { describe, expect, it } from 'vitest'
import { getAgentLabel as getSharedAgentLabel } from './agent-title-identity'
import { isOpenCodeNativeTitle } from './opencode-terminal-title'
import {
  isClaudeAgent,
  isClaudeIdentityFrameTitle,
  resolveExplicitTerminalTitleAgentType,
  resolveTerminalTitleAgentType
} from './terminal-title-agent-type'

describe('resolveExplicitTerminalTitleAgentType', () => {
  it('maps explicit product-name titles to their TuiAgent id', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ Claude Code')).toBe('claude')
    expect(resolveExplicitTerminalTitleAgentType('⠋ OpenCode')).toBe('opencode')
    expect(resolveExplicitTerminalTitleAgentType('OpenCode ready')).toBe('opencode')
    expect(resolveExplicitTerminalTitleAgentType('Pi')).toBe('pi')
  })

  it('treats Claude generic status prefixes as activity-only, not identity', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ investigating startup')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('⠸ investigating startup')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('. Compare Opencode Vs Orca')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('* Review OpenCode behavior')).toBeNull()
  })

  it('resolves OpenCode native abbreviated session titles before task-text identities', () => {
    expect(resolveExplicitTerminalTitleAgentType('OC | Understand about the plugin')).toBe(
      'opencode'
    )
    expect(resolveExplicitTerminalTitleAgentType('OC | Compare Pi and Claude')).toBe('opencode')
    expect(getSharedAgentLabel('OC | Compare Pi and Claude')).toBe('OpenCode')
    expect(resolveExplicitTerminalTitleAgentType('tmux | OC | ses_123')).toBe('opencode')
    expect(resolveExplicitTerminalTitleAgentType('OC|compact-session')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('oc | Understand about the plugin')).toBeNull()
  })

  it('does not find an OpenCode marker inside another agent task title', () => {
    expect(isOpenCodeNativeTitle('⠋ Fix foo | OC | bar')).toBe(false)
    expect(resolveExplicitTerminalTitleAgentType('⠋ Fix foo | OC | bar')).toBeNull()
  })

  // Why: adversarial coverage — native OC must not steal Claude/Pi identity,
  // and those agents must keep resolving when titled normally.
  it('keeps other agents classified correctly alongside OpenCode native titles', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ Claude Code')).toBe('claude')
    expect(resolveExplicitTerminalTitleAgentType('Pi ready')).toBe('pi')
    expect(resolveExplicitTerminalTitleAgentType('OpenCode ready')).toBe('opencode')
    expect(resolveTerminalTitleAgentType('OC | ⠋ implementing the feature')).toBe('opencode')
    expect(isClaudeAgent('OC | ⠋ implementing the feature')).toBe(false)
    expect(isClaudeAgent('OC | Understand about the plugin')).toBe(false)
  })

  it('still resolves Claude when the title explicitly names Claude', () => {
    expect(resolveExplicitTerminalTitleAgentType('. Claude Code compare Opencode')).toBe('claude')
  })

  // Why (#8940): only a title that PRESENTS Claude may take a pane from its known owner —
  // a "claude" token inside another agent's task text is a mention, not identity.
  it('separates Claude identity frames from an incidental claude token', () => {
    for (const title of [
      'Claude Code',
      '✳ Claude Code',
      '⠋ Claude Code',
      'claude',
      '. claude',
      'Claude Code ready',
      'Claude - action required',
      // A multiplexer prefix must not read as task text and cost Claude its identity.
      'zsh | ⠋ Claude Code',
      'tmux | dev | Claude Code ready'
    ]) {
      expect(isClaudeIdentityFrameTitle(title)).toBe(true)
    }
    for (const title of [
      '⠋ use Claude Sonnet',
      'OC | ⠋ ask claude about this',
      '⠋ port the claude prompt',
      '. ship it with claude',
      '⠋ claude 스타일로 리팩터',
      '. Claude Code compare Opencode',
      '✳ investigating startup',
      '✳'
    ]) {
      expect(isClaudeIdentityFrameTitle(title)).toBe(false)
    }
  })

  it('returns null for plain shell and unknown titles', () => {
    expect(resolveExplicitTerminalTitleAgentType('Terminal 1')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('zsh')).toBeNull()
  })

  // Why: a Claude tab whose task text mentions a text cursor is not an agent identity.
  it('does not treat a bare cursor token as identity', () => {
    expect(
      resolveExplicitTerminalTitleAgentType('⠋ preserve cursor visibility across replays')
    ).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('~/cursor-rules')).toBeNull()
  })
})

describe('resolveTerminalTitleAgentType', () => {
  // Why: the activity facet keeps Claude's braille prefix as Claude.
  it('labels cursor-mentioning agent tabs by their true agent', () => {
    expect(resolveTerminalTitleAgentType('⠋ preserve cursor visibility across replays')).toBe(
      'claude'
    )
    expect(resolveTerminalTitleAgentType('⠋ OpenCode: fix cursor offsets')).toBe('opencode')
  })
})

// Why: this module carries its own isClaudeAgent copy parallel to agent-title-identity.ts;
// both carry the identical openclaude guard, so pin this copy directly to catch drift.
describe('isClaudeAgent', () => {
  it('excludes OpenClaude titles, keeps cursor-mentioning Claude braille titles', () => {
    expect(isClaudeAgent('⠋ preserve cursor visibility across replays')).toBe(true)
    expect(isClaudeAgent('⠋ OpenClaude')).toBe(false)
  })
})
