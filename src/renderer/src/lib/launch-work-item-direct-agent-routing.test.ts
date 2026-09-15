import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settleStructuredAgentLaunch: vi.fn(),
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/lib/structured-agent-launch-settlement', () => ({
  settleStructuredAgentLaunch: mocks.settleStructuredAgentLaunch
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))

import { adoptAgentSessionLaunchVerdict } from './agent-session-launch-plan'
import { settleDirectWorkItemStructuredLaunch } from './launch-work-item-direct-agent-routing'

const structuredPlan = adoptAgentSessionLaunchVerdict({
  route: 'structured-native-chat',
  agent: 'claude',
  worktreeId: 'worktree-1',
  prompt: 'Fix the route',
  promptDelivery: 'draft'
})

const baseArgs = {
  plan: structuredPlan,
  worktreeId: 'worktree-1',
  primaryTabId: null,
  startupPlan: null,
  launchSource: 'task_page' as const
}

describe('settleDirectWorkItemStructuredLaunch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves the editable delivery mode for the default-agent PR launch', async () => {
    mocks.settleStructuredAgentLaunch.mockResolvedValue({
      kind: 'structured',
      sessionId: 'draft-session'
    })
    await expect(settleDirectWorkItemStructuredLaunch(baseArgs)).resolves.toEqual({
      completed: true,
      structuredLaunch: true,
      visibilityUnknown: false,
      failed: false,
      primaryTabId: null
    })
    expect(mocks.settleStructuredAgentLaunch).toHaveBeenCalledWith(
      'worktree-1',
      'claude',
      { prompt: 'Fix the route', promptDelivery: 'draft' },
      expect.anything()
    )
  })

  it('runs the legacy terminal as the refusal fallback', async () => {
    mocks.activateAndRevealWorktree.mockReturnValue({ primaryTabId: 'fallback-tab' })
    mocks.settleStructuredAgentLaunch.mockImplementation(
      async (_worktreeId, _agent, _options, hooks) => ({
        kind: 'refused-then-legacy',
        ...(await hooks.legacyFallback())
      })
    )

    await expect(settleDirectWorkItemStructuredLaunch(baseArgs)).resolves.toEqual({
      completed: false,
      structuredLaunch: false,
      visibilityUnknown: false,
      failed: false,
      primaryTabId: 'fallback-tab'
    })
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith(
      'worktree-1',
      expect.objectContaining({ sidebarRevealBehavior: 'auto', createNewTerminalForStartup: true })
    )
  })

  it('reports an unknown outcome without starting a fallback terminal', async () => {
    mocks.settleStructuredAgentLaunch.mockResolvedValue({
      kind: 'visibility-unknown',
      sessionId: 'session-1'
    })

    await expect(settleDirectWorkItemStructuredLaunch(baseArgs)).resolves.toEqual({
      completed: false,
      structuredLaunch: true,
      visibilityUnknown: true,
      failed: false,
      primaryTabId: null
    })
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
  })

  it.each([
    ['failed', { kind: 'failed', error: new Error('x') }],
    ['cancelled', { kind: 'cancelled', sessionId: 'session-1' }]
  ])(
    'drops the pre-launch tab on a %s settlement so nothing is pasted into it',
    async (_kind, settlement) => {
      mocks.settleStructuredAgentLaunch.mockResolvedValue(settlement)

      await expect(
        settleDirectWorkItemStructuredLaunch({ ...baseArgs, primaryTabId: 'setup-shell-tab' })
      ).resolves.toEqual({
        completed: false,
        structuredLaunch: true,
        visibilityUnknown: false,
        failed: true,
        primaryTabId: null
      })
      expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
    }
  )

  it('skips the loop when the route is not structured', async () => {
    await expect(
      settleDirectWorkItemStructuredLaunch({
        ...baseArgs,
        plan: adoptAgentSessionLaunchVerdict({ ...structuredPlan, route: 'legacy-native-chat' })
      })
    ).resolves.toEqual({
      completed: false,
      structuredLaunch: false,
      visibilityUnknown: false,
      failed: false,
      primaryTabId: null
    })
    expect(mocks.settleStructuredAgentLaunch).not.toHaveBeenCalled()
  })
})
