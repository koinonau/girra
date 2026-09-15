import { describe, expect, it } from 'vitest'
import {
  resolveWindowsShiftEnterEncoding,
  resolveWindowsShiftEnterEncodingForPane
} from './terminal-windows-shift-enter'

describe('resolveWindowsShiftEnterEncoding', () => {
  it('uses CSI-u only for trusted Pi process evidence', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: 'pi', routingTrusted: true, shellForeground: false }
      })
    ).toBe('csi-u')
    expect(resolveWindowsShiftEnterEncoding({ launchAgentType: 'pi' })).toBe('alt-enter')
  })

  it('recovers Pi CSI-u from its explicit title when process trust is unavailable', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        'tab:pane': { agent: null, shellForeground: false }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', '⠸ Pi')).toBe('csi-u')
    expect(
      resolveWindowsShiftEnterEncodingForPane(
        { paneForegroundAgentByPaneKey: {}, agentLaunchConfigByPaneKey: {} },
        'tab:pane',
        'Pi ready'
      )
    ).toBe('csi-u')
  })

  it('keeps trusted process and shell evidence authoritative over titles', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        'tab:pane': {
          agent: 'opencode' as const,
          routingTrusted: true,
          shellForeground: false
        }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'Pi ready')).toBe('alt-enter')
    expect(
      resolveWindowsShiftEnterEncodingForPane(
        {
          paneForegroundAgentByPaneKey: {
            'tab:pane': { agent: null, shellForeground: true }
          },
          agentLaunchConfigByPaneKey: {}
        },
        'tab:pane',
        'Pi ready'
      )
    ).toBe('alt-enter')
  })

  it('does not let a stale title undo explicit routing revocation', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        'tab:pane': {
          agent: 'pi' as const,
          routingRevoked: true,
          shellForeground: false
        }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'Pi ready')).toBe('alt-enter')
  })

  it('keeps the last CSI-u capability while revocation confirmation is pending', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: {
          agent: 'pi',
          routingRevoked: true,
          routingConfirmationPending: true,
          shellForeground: false
        }
      })
    ).toBe('csi-u')
  })

  it('keeps legacy bytes for plain shell and unsupported-agent titles', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'C:\\work\\pi-project')).toBe(
      'alt-enter'
    )
    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'OpenCode')).toBe('alt-enter')
  })

  it('does not let hook status route bytes without a pane title or process proof', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentStatusByPaneKey: {
        'tab:pane': { agentType: 'pi' as const }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane')).toBe('alt-enter')
  })

  it('keeps the legacy byte for OpenCode, Claude, unknown, and plain panes', () => {
    for (const agent of ['opencode', 'claude', null] as const) {
      expect(
        resolveWindowsShiftEnterEncoding({
          foreground: { agent, shellForeground: false }
        })
      ).toBe('alt-enter')
    }
    expect(resolveWindowsShiftEnterEncoding({})).toBe('alt-enter')
  })

  it('lets current process identity override stale launch ownership', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: 'opencode', routingTrusted: true, shellForeground: false },
        launchAgentType: 'pi'
      })
    ).toBe('alt-enter')
  })

  it('fails closed while a newer command generation awaits trusted evidence', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: 'pi', shellForeground: false },
        launchAgentType: 'pi'
      })
    ).toBe('alt-enter')
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: null, shellForeground: false },
        launchAgentType: 'pi'
      })
    ).toBe('alt-enter')
  })

  it('keeps launch ownership on its original leaf after a split sibling survives', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentLaunchConfigByPaneKey: {
        'tab:launched-pi': { identity: { agentType: 'pi' } }
      }
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:launched-pi')).toBe('alt-enter')
    // Why: after split→close leaves only the sibling, pane count is no longer
    // ownership evidence; the surviving leaf must keep the legacy fallback.
    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:surviving-sibling')).toBe(
      'alt-enter'
    )
  })

  it('clears stale Pi ownership after the foreground returns to the shell', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: null, shellForeground: true },
        launchAgentType: 'pi'
      })
    ).toBe('alt-enter')
  })
})
