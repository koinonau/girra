import { describe, expect, it } from 'vitest'
import {
  buildTabAgentLaunchOptions,
  findMatchingTabAgentLaunchOptions,
  orderTabLaunchAgents
} from './tab-agent-launch-options'

describe('tab agent launch options', () => {
  it('orders detected agents by the configured default first', () => {
    expect(orderTabLaunchAgents('opencode', ['claude', 'opencode', 'pi'])).toEqual([
      'opencode',
      'claude',
      'pi'
    ])
  })

  it('excludes disabled agents from the launch list', () => {
    expect(orderTabLaunchAgents(null, ['claude', 'opencode', 'pi'], ['pi'])).toEqual([
      'claude',
      'opencode'
    ])
  })

  it('drops a disabled default agent instead of surfacing it first', () => {
    const ordered = orderTabLaunchAgents('pi', ['claude', 'opencode', 'pi'], ['pi'])
    expect(ordered).not.toContain('pi')
    expect(ordered).toEqual(['claude', 'opencode'])
  })

  it('keeps a disabled agent out of new-tab search results', () => {
    const options = buildTabAgentLaunchOptions(
      orderTabLaunchAgents('opencode', ['claude', 'opencode', 'pi'], ['pi'])
    )
    expect(findMatchingTabAgentLaunchOptions('pi', options).map((o) => o.agent)).toEqual([])
  })

  it('matches detected agents by id, label, command, and command override', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'claude-agent-teams', 'opencode'], {
      opencode: 'opencode-beta'
    })

    expect(
      findMatchingTabAgentLaunchOptions('Claude Agent Teams', options).map((option) => option.agent)
    ).toEqual(['claude-agent-teams'])
    expect(findMatchingTabAgentLaunchOptions('sst opencode', options)).toEqual([])
    expect(
      findMatchingTabAgentLaunchOptions('opencode-beta', options).map((option) => option.agent)
    ).toEqual(['opencode'])
    expect(
      findMatchingTabAgentLaunchOptions('girra', options).map((option) => option.agent)
    ).toEqual(['claude-agent-teams'])
  })

  it('matches agents on a partial prefix so the launcher actually searches', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'opencode', 'pi'])

    // Each is one character short of the full agent name.
    expect(findMatchingTabAgentLaunchOptions('opencod', options).map((o) => o.agent)).toEqual([
      'opencode'
    ])
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual([
      'claude'
    ])
  })

  it('ranks an exact alias above weaker prefix matches', () => {
    const options = buildTabAgentLaunchOptions(['claude-agent-teams', 'claude'])

    // "clau" prefixes both; "claude" exactly matches one and must lead.
    expect(findMatchingTabAgentLaunchOptions('claude', options)[0]?.agent).toBe('claude')
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual(
      expect.arrayContaining(['claude-agent-teams', 'claude'])
    )
  })

  it('does not match on a mid-string substring that would hijack file results', () => {
    const options = buildTabAgentLaunchOptions(['opencode', 'claude'])

    // "ode" is inside "opencode" but not a prefix — agents rank above files, so
    // a noisy mid-string hit must not surface.
    expect(findMatchingTabAgentLaunchOptions('ode', options)).toEqual([])
  })

  it('requires at least two characters before a prefix matches (no single-key flood)', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'claude-agent-teams', 'opencode', 'pi'])

    // A lone "c" must not surface (and auto-launch) an agent.
    expect(findMatchingTabAgentLaunchOptions('c', options)).toEqual([])
    // Two characters is enough to start searching.
    expect(findMatchingTabAgentLaunchOptions('cl', options).map((o) => o.agent)).toEqual(
      expect.arrayContaining(['claude', 'claude-agent-teams'])
    )
  })
})
