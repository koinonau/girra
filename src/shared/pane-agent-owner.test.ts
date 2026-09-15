import { describe, expect, it } from 'vitest'
import { resolvePaneAgentOwner, resolvePaneAgentOwnerRecord } from './pane-agent-owner'

describe('resolvePaneAgentOwner', () => {
  it('leads with launch intent', () => {
    expect(
      resolvePaneAgentOwner({
        launchAgent: 'opencode',
        hookAgent: 'pi',
        sleepingSessionAgent: 'claude'
      })
    ).toBe('opencode')
    expect(resolvePaneAgentOwner({ startupLaunchAgent: 'pi', hookAgent: 'claude' })).toBe('pi')
    expect(resolvePaneAgentOwner({ commandInferredAgent: 'claude', hookAgent: 'opencode' })).toBe(
      'claude'
    )
  })

  it('falls through to the durable host-stamped hook identity when launch intent is gone', () => {
    // The mirror/restore case: launchAgent dropped, live hook is the anchor.
    expect(resolvePaneAgentOwner({ hookAgent: 'opencode' })).toBe('opencode')
    // Live hook cleared: the last completed hook carries the identity.
    expect(resolvePaneAgentOwner({ completedHookAgent: 'opencode' })).toBe('opencode')
    // Nothing live at all: the hibernated session record is the last resort.
    expect(resolvePaneAgentOwner({ sleepingSessionAgent: 'opencode' })).toBe('opencode')
  })

  it('ranks live/recent evidence above the hibernated record so a stale record cannot hijack', () => {
    expect(resolvePaneAgentOwner({ hookAgent: 'pi', sleepingSessionAgent: 'opencode' })).toBe('pi')
    expect(
      resolvePaneAgentOwner({ completedHookAgent: 'pi', sleepingSessionAgent: 'opencode' })
    ).toBe('pi')
  })

  it('prefers focused over sibling evidence at each tier', () => {
    expect(resolvePaneAgentOwner({ hookAgent: 'opencode', siblingHookAgent: 'pi' })).toBe(
      'opencode'
    )
    expect(
      resolvePaneAgentOwner({ completedHookAgent: 'opencode', siblingCompletedHookAgent: 'pi' })
    ).toBe('opencode')
  })

  it('preserves the pre-tranche precedence for every conflicting owner tier', () => {
    expect(
      resolvePaneAgentOwnerRecord({
        launchAgent: 'claude',
        hookAgent: 'opencode',
        siblingHookAgent: 'pi',
        completedHookAgent: 'claude-agent-teams',
        sleepingSessionAgent: 'opencode'
      })
    ).toEqual({ agent: 'claude', ownerIsLaunch: true })
    expect(
      resolvePaneAgentOwnerRecord({
        hookAgent: 'claude',
        siblingHookAgent: 'opencode',
        completedHookAgent: 'pi',
        siblingCompletedHookAgent: 'claude-agent-teams',
        sleepingSessionAgent: 'opencode'
      })
    ).toEqual({ agent: 'claude', ownerIsLaunch: false })
    expect(
      resolvePaneAgentOwnerRecord({
        siblingHookAgent: 'opencode',
        completedHookAgent: 'claude',
        siblingCompletedHookAgent: 'pi',
        sleepingSessionAgent: 'claude-agent-teams'
      })
    ).toEqual({ agent: 'opencode', ownerIsLaunch: false })
    expect(
      resolvePaneAgentOwnerRecord({
        completedHookAgent: 'claude',
        siblingCompletedHookAgent: 'opencode',
        sleepingSessionAgent: 'pi'
      })
    ).toEqual({ agent: 'claude', ownerIsLaunch: false })
  })

  it('returns null when no owner evidence exists', () => {
    expect(resolvePaneAgentOwner({})).toBeNull()
    expect(resolvePaneAgentOwner({ launchAgent: null, hookAgent: undefined })).toBeNull()
    expect(resolvePaneAgentOwnerRecord({})).toBeNull()
  })

  it('marks launch-tier evidence as launch ownership and status-tier as inferred', () => {
    expect(resolvePaneAgentOwnerRecord({ launchAgent: 'pi', hookAgent: 'opencode' })).toEqual({
      agent: 'pi',
      ownerIsLaunch: true
    })
    expect(
      resolvePaneAgentOwnerRecord({ startupLaunchAgent: 'pi', hookAgent: 'opencode' })
    ).toEqual({
      agent: 'pi',
      ownerIsLaunch: true
    })
    expect(resolvePaneAgentOwnerRecord({ hookAgent: 'opencode' })).toEqual({
      agent: 'opencode',
      ownerIsLaunch: false
    })
    expect(resolvePaneAgentOwnerRecord({ completedHookAgent: 'pi' })).toEqual({
      agent: 'pi',
      ownerIsLaunch: false
    })
  })
})
