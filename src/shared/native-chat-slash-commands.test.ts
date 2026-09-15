import { describe, expect, it } from 'vitest'
import {
  applySlashSuggestion,
  filterSlashCommands,
  getAgentSlashCommands,
  isSlashCommandDraft,
  sessionReportedSkillNames,
  sessionSlashCommandSuggestions,
  slashCommandDispatchText
} from './native-chat-slash-commands'

describe('getAgentSlashCommands', () => {
  it('returns Claude commands for claude', () => {
    const names = getAgentSlashCommands('claude').map((c) => c.name)
    expect(names).toContain('clear')
    expect(names).toContain('compact')
    expect(names).not.toContain('model')
  })

  it('falls back to a small common set for an unknown agent (never empty)', () => {
    const names = getAgentSlashCommands('some-other-agent').map((c) => c.name)
    expect(names).toEqual(['clear', 'help'])
  })
})

describe('isSlashCommandDraft', () => {
  it('is true for a leading slash, even with leading whitespace', () => {
    expect(isSlashCommandDraft('/clear')).toBe(true)
    expect(isSlashCommandDraft('  /model')).toBe(true)
  })

  it('is false for ordinary prose or a mid-line slash', () => {
    expect(isSlashCommandDraft('fix the bug')).toBe(false)
    expect(isSlashCommandDraft('run a/b test')).toBe(false)
    expect(isSlashCommandDraft('')).toBe(false)
  })
})

describe('filterSlashCommands', () => {
  const claude = getAgentSlashCommands('claude')

  it('returns all commands for an empty query (bare /)', () => {
    expect(filterSlashCommands(claude, '')).toHaveLength(claude.length)
  })

  it('prefix-matches case-insensitively', () => {
    const names = filterSlashCommands(claude, 'com').map((c) => c.name)
    expect(names).toEqual(['compact'])
    expect(filterSlashCommands(claude, 'COM').map((c) => c.name)).toEqual(['compact'])
  })
})

describe('dispatch vs completion text', () => {
  it('dispatch text has no trailing space (Enter dispatches the command)', () => {
    expect(slashCommandDispatchText({ name: 'clear' })).toBe('/clear')
  })

  it('completion text has a trailing space (Tab completes for arguments)', () => {
    expect(applySlashSuggestion({ name: 'model' })).toBe('/model ')
  })
})

describe('a session that reports its own command surface', () => {
  const reported = [
    { name: 'clear', kind: 'command' as const },
    { name: 'opsx:apply', kind: 'command' as const },
    { name: 'ref-oss', kind: 'skill' as const }
  ]

  it('offers exactly the reported commands, described from the curated catalog', () => {
    expect(sessionSlashCommandSuggestions('claude', reported)).toEqual([
      { name: 'clear', description: 'Clear conversation history' },
      { name: 'opsx:apply' }
    ])
  })

  it('does not resurrect a curated command the session never reported', () => {
    const names = sessionSlashCommandSuggestions('claude', reported).map((c) => c.name)
    expect(names).not.toContain('compact')
  })

  it('splits skills out for the picker to group on its own', () => {
    expect(sessionReportedSkillNames(reported)).toEqual(['ref-oss'])
  })

  it('prefers the description the session reported over the curated one', () => {
    expect(
      sessionSlashCommandSuggestions('claude', [
        { name: 'clear', kind: 'command', description: 'Wipe the transcript' },
        { name: 'goal', kind: 'command', description: 'Set or view the goal' },
        { name: 'compact', kind: 'command' }
      ])
    ).toEqual([
      { name: 'clear', description: 'Wipe the transcript' },
      { name: 'goal', description: 'Set or view the goal' },
      { name: 'compact', description: 'Summarize and compact the conversation' }
    ])
  })

  it('keeps a reported description and argument hint the curated catalog never claims', () => {
    expect(
      sessionSlashCommandSuggestions('claude', [
        {
          name: 'opsx:apply',
          kind: 'command',
          description: 'Apply the plan',
          argumentHint: '<plan-id>',
          kindUnspecified: true
        }
      ])
    ).toEqual([
      {
        name: 'opsx:apply',
        description: 'Apply the plan',
        argumentHint: '<plan-id>',
        kindUnspecified: true
      }
    ])
  })
})
