import { describe, expect, it } from 'vitest'
import {
  haveSameDisabledTuiAgents,
  normalizeDisabledTuiAgents,
  pickTuiAgent
} from './tui-agent-selection'

describe('pickTuiAgent', () => {
  it('uses an installed preferred agent', () => {
    expect(pickTuiAgent('opencode', ['claude', 'opencode'])).toBe('opencode')
  })

  it('falls back in desktop catalog order when the preference is absent or stale', () => {
    expect(pickTuiAgent(null, ['pi', 'opencode'])).toBe('opencode')
    expect(pickTuiAgent('claude', ['pi', 'opencode'])).toBe('opencode')
    expect(pickTuiAgent(null, ['pi', 'claude-agent-teams'])).toBe('claude-agent-teams')
  })

  it('respects the explicit blank terminal preference', () => {
    expect(pickTuiAgent('blank', ['pi', 'claude'])).toBeNull()
  })

  it('ignores disabled preferred and fallback agents', () => {
    expect(pickTuiAgent('opencode', ['claude', 'opencode'], ['opencode'])).toBe('claude')
    expect(pickTuiAgent(null, ['claude', 'opencode'], ['claude', 'opencode'])).toBeNull()
  })
})

describe('normalizeDisabledTuiAgents', () => {
  it('dedupes supported agent ids and drops unsupported values', () => {
    expect(normalizeDisabledTuiAgents(['pi', 'codex', 'pi', null, 'claude'])).toEqual([
      'pi',
      'claude'
    ])
  })
})

describe('haveSameDisabledTuiAgents', () => {
  it('compares the normalized disabled-agent sets', () => {
    expect(haveSameDisabledTuiAgents(['pi', 'claude'], ['claude', 'pi'])).toBe(true)
    expect(haveSameDisabledTuiAgents(['pi', 'codex'], ['pi'])).toBe(true)
    expect(haveSameDisabledTuiAgents(['pi'], ['claude'])).toBe(false)
  })
})
