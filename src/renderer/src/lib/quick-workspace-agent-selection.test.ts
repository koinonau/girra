import { describe, expect, it } from 'vitest'
import { TUI_AGENT_AUTO_PICK_ORDER } from '../../../shared/tui-agent-selection'
import { AGENT_CATALOG } from './agent-catalog'
import {
  pickQuickWorkspaceAgent,
  resolveQuickWorkspaceAgentSelection
} from './quick-workspace-agent-selection'

describe('pickQuickWorkspaceAgent', () => {
  it('keeps the fallback order in sync with the desktop agent catalog', () => {
    expect(TUI_AGENT_AUTO_PICK_ORDER).toEqual(AGENT_CATALOG.map((agent) => agent.id))
    expect(new Set(TUI_AGENT_AUTO_PICK_ORDER).size).toBe(TUI_AGENT_AUTO_PICK_ORDER.length)
  })

  it('uses the first enabled catalog agent while detection is pending', () => {
    expect(pickQuickWorkspaceAgent(null, null, [])).toBe('claude')
    expect(pickQuickWorkspaceAgent(null, null, ['claude'])).toBe('claude-agent-teams')
    expect(pickQuickWorkspaceAgent(null, null, ['claude', 'claude-agent-teams'])).toBe('opencode')
    expect(pickQuickWorkspaceAgent(null, null, ['claude', 'claude-agent-teams', 'opencode'])).toBe(
      'pi'
    )
  })

  it('respects blank and disabled preferred agents', () => {
    expect(pickQuickWorkspaceAgent('blank', null, [])).toBeNull()
    expect(pickQuickWorkspaceAgent('opencode', null, ['opencode'])).toBe('claude')
  })

  it('uses detected enabled agents after detection resolves', () => {
    expect(pickQuickWorkspaceAgent(null, ['opencode'], ['claude'])).toBe('opencode')
    expect(pickQuickWorkspaceAgent('opencode', ['claude', 'opencode'], ['opencode'])).toBe('claude')
  })
})

describe('resolveQuickWorkspaceAgentSelection', () => {
  it('uses the preferred quick agent until the user picks an override', () => {
    expect(
      resolveQuickWorkspaceAgentSelection({
        quickAgentOverride: undefined,
        preferredQuickAgent: 'claude',
        detectedAgentIds: ['claude', 'opencode'],
        disabledTuiAgents: []
      })
    ).toEqual({ quickAgent: 'claude', quickAgentOverride: undefined })
  })

  it('keeps explicit blank overrides stable', () => {
    expect(
      resolveQuickWorkspaceAgentSelection({
        quickAgentOverride: null,
        preferredQuickAgent: 'claude',
        detectedAgentIds: ['claude'],
        disabledTuiAgents: []
      })
    ).toEqual({ quickAgent: null, quickAgentOverride: null })
  })

  it('keeps an available user override', () => {
    expect(
      resolveQuickWorkspaceAgentSelection({
        quickAgentOverride: 'opencode',
        preferredQuickAgent: 'claude',
        detectedAgentIds: new Set(['claude', 'opencode']),
        disabledTuiAgents: []
      })
    ).toEqual({ quickAgent: 'opencode', quickAgentOverride: 'opencode' })
  })

  it('replaces an unavailable override with the preferred quick agent', () => {
    expect(
      resolveQuickWorkspaceAgentSelection({
        quickAgentOverride: 'opencode',
        preferredQuickAgent: 'claude',
        detectedAgentIds: ['claude'],
        disabledTuiAgents: []
      })
    ).toEqual({ quickAgent: 'claude', quickAgentOverride: 'claude' })
  })
})
