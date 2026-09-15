import { describe, expect, it } from 'vitest'

import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { PaneForegroundAgentEntry } from '../../store/slices/pane-foreground-agent'
import { resolveProtectedMultilinePasteOptionsForPane } from './terminal-agent-paste-bracketing'
import type { TerminalPasteTextOptions } from './terminal-paste-coordinator'

const TAB_ID = 'tab-1'
const AGENT_LEAF = '11111111-1111-4111-8111-111111111111'
const SHELL_LEAF = '22222222-2222-4222-8222-222222222222'
const AGENT_PANE_KEY = `${TAB_ID}:${AGENT_LEAF}`

function agentEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'waiting',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    stateHistory: [],
    agentType: 'opencode',
    paneKey: AGENT_PANE_KEY,
    ...overrides
  }
}

function foregroundEntry(
  overrides: Partial<PaneForegroundAgentEntry> = {}
): PaneForegroundAgentEntry {
  return { agent: null, shellForeground: false, ...overrides }
}

const OPENCODE_ON_AGENT_LEAF = { [AGENT_PANE_KEY]: agentEntry() }

function decide(
  args: Partial<Parameters<typeof resolveProtectedMultilinePasteOptionsForPane>[0]> = {}
): TerminalPasteTextOptions | undefined {
  return resolveProtectedMultilinePasteOptionsForPane({
    isWindowsClient: false,
    hostPlatform: 'linux',
    agentStatusByPaneKey: OPENCODE_ON_AGENT_LEAF,
    paneForegroundAgentByPaneKey: {},
    tabId: TAB_ID,
    leafId: AGENT_LEAF,
    ...args
  })
}

describe('resolveProtectedMultilinePasteOptionsForPane', () => {
  it('brackets an agent pane on a non-Windows host', () => {
    expect(decide()).toEqual({ forceBracketedPasteForMultiline: true })
  })

  it('leaves a plain shell pane alone so ESC[200~ never reaches a non-TUI program', () => {
    expect(decide({ leafId: SHELL_LEAF })).toBeUndefined()
  })

  it('gates per leaf, not per tab', () => {
    expect(decide({ tabId: 'other-tab' })).toBeUndefined()
  })

  it('keeps the existing Windows-client behaviour for non-agent panes', () => {
    expect(decide({ isWindowsClient: true, agentStatusByPaneKey: {}, leafId: SHELL_LEAF })).toEqual(
      { forceBracketedPasteForMultiline: true }
    )
  })

  it('ignores a pane whose agentType is not a TUI agent', () => {
    expect(
      decide({
        agentStatusByPaneKey: {
          [AGENT_PANE_KEY]: agentEntry({
            agentType: 'not-an-agent' as AgentStatusEntry['agentType']
          })
        }
      })
    ).toBeUndefined()
  })

  it('brackets on a process-confirmed agent even with no status row', () => {
    expect(
      decide({
        agentStatusByPaneKey: {},
        paneForegroundAgentByPaneKey: {
          [AGENT_PANE_KEY]: foregroundEntry({ agent: 'opencode', shellForeground: false })
        }
      })
    ).toEqual({ forceBracketedPasteForMultiline: true })
  })

  it('vetoes a row rehydrated from disk across an app restart', () => {
    expect(
      decide({
        agentStatusByPaneKey: {
          [AGENT_PANE_KEY]: agentEntry({ restoredUnconfirmed: true })
        }
      })
    ).toBeUndefined()
  })

  it('still brackets a long-idle agent parked at done', () => {
    // Why: an idle-but-live agent sits at `done` with an old updatedAt. Gating on
    // state or the 30-minute freshness TTL would strip bracketing from exactly the
    // pane that needs it most.
    expect(
      decide({
        agentStatusByPaneKey: {
          [AGENT_PANE_KEY]: agentEntry({ state: 'done', updatedAt: 0, stateStartedAt: 0 })
        }
      })
    ).toEqual({ forceBracketedPasteForMultiline: true })
  })

  it('degrades to the pre-fix path instead of throwing on a malformed pane key', () => {
    // Why: makePaneKey throws on a non-UUID leaf or a tabId containing ':'. The throw
    // would escape before the paste helper's catch is attached, making the paste a
    // silent no-op with no error surface.
    expect(() => decide({ leafId: 'not-a-uuid' })).not.toThrow()
    expect(decide({ leafId: 'not-a-uuid' })).toBeUndefined()
    expect(() => decide({ tabId: 'tab:with:colons' })).not.toThrow()
    expect(decide({ tabId: 'tab:with:colons' })).toBeUndefined()
  })

  it('still brackets when shellForeground is latched true while an agent owns the pane', () => {
    // Why: shellForeground is republished only at OSC 133 boundaries, so a shell with
    // no 133 integration leaves it true while an agent runs. Measured live: vetoing on
    // it reinstated the submit bug.
    expect(
      decide({
        paneForegroundAgentByPaneKey: {
          [AGENT_PANE_KEY]: foregroundEntry({ shellForeground: true })
        }
      })
    ).toEqual({ forceBracketedPasteForMultiline: true })
  })

  it('brackets agent pastes on a Windows host', () => {
    expect(
      decide({
        hostPlatform: 'win32',
        agentStatusByPaneKey: {
          [AGENT_PANE_KEY]: agentEntry({ agentType: 'pi' })
        }
      })
    ).toEqual({ forceBracketedPasteForMultiline: true })
  })
})
