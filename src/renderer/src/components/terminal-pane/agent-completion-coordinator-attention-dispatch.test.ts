import { describe, expect, it, vi } from 'vitest'
import { createAgentCompletionCoordinator } from './agent-completion-coordinator'
import {
  HOOK_DONE_QUIET_MS,
  useAgentCompletionCoordinatorLifecycle
} from './agent-completion-coordinator-test-harness'

describe('agent completion coordinator', () => {
  useAgentCompletionCoordinatorLifecycle()

  it('does not dispatch completion when waiting states arrive mid-turn', () => {
    const dispatchCompletion = vi.fn()
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      dispatchAttention,
      isLive: () => true
    })

    const turn = {
      prompt: 'fix the bug',
      agentType: 'opencode' as const
    }

    // 'waiting' (e.g. a PermissionRequest) is mid-turn, not a completion.
    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'pnpm test'
    })
    coordinator.observeHookStatus({
      state: 'working',
      ...turn,
      toolName: 'Read',
      toolInput: '/repo/src/app.ts'
    })
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'git status'
    })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).not.toHaveBeenCalled()
    expect(dispatchAttention).toHaveBeenCalledTimes(2)
    expect(dispatchAttention).toHaveBeenLastCalledWith(
      'opencode',
      expect.objectContaining({
        source: 'hook',
        agentStatus: expect.objectContaining({
          state: 'waiting',
          agentType: 'opencode',
          toolInput: 'git status'
        })
      })
    )
  })

  it('does not dispatch completion when a blocked state arrives mid-turn', () => {
    const dispatchCompletion = vi.fn()
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      dispatchAttention,
      isLive: () => true
    })

    const turn = {
      prompt: 'fix the bug',
      agentType: 'claude' as const
    }

    // 'blocked' (e.g. a Claude elicitation dialog) is mid-turn, not a completion.
    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({
      state: 'blocked',
      ...turn,
      toolName: 'Shell',
      toolInput: 'npm install'
    })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).not.toHaveBeenCalled()
    expect(dispatchAttention).toHaveBeenCalledWith(
      'claude',
      expect.objectContaining({
        source: 'hook',
        agentStatus: expect.objectContaining({
          state: 'blocked',
          agentType: 'claude',
          toolInput: 'npm install'
        })
      })
    )
  })

  it('cancels a pending done timer when a waiting state arrives before the quiet window', () => {
    const dispatchCompletion = vi.fn()
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      dispatchAttention,
      isLive: () => true
    })

    const turn = {
      prompt: 'fix the bug',
      agentType: 'opencode' as const
    }

    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({ state: 'done', ...turn, lastAssistantMessage: 'Done.' })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(true)

    // A permission/elicitation pause arrives before the 1.5s quiet window
    // expires; it must cancel the pending 'done' so no completion fires.
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'pnpm test'
    })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(false)
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).not.toHaveBeenCalled()
    expect(dispatchAttention).toHaveBeenCalledWith(
      'opencode',
      expect.objectContaining({
        source: 'hook',
        agentStatus: expect.objectContaining({
          state: 'waiting',
          agentType: 'opencode',
          toolInput: 'pnpm test'
        })
      })
    )
  })

  it('still dispatches completion on done after an intervening waiting state in the same turn', () => {
    const dispatchCompletion = vi.fn()
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      dispatchAttention,
      isLive: () => true
    })

    const turn = {
      prompt: 'fix the bug',
      agentType: 'opencode' as const
    }

    // Realistic flow: the agent pauses for a permission prompt mid-turn, resumes,
    // then genuinely finishes. The intervening attention state must surface as
    // attention only and must not suppress the final completion. This fails if
    // 'waiting' is treated as a completion state (issue #5698).
    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'pnpm test'
    })
    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({ state: 'done', ...turn, lastAssistantMessage: 'Done.' })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchAttention).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
  })

  it('dispatches an attention notification immediately without debounce', () => {
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion: vi.fn(),
      dispatchAttention,
      isLive: () => true
    })

    const turn = { prompt: 'fix the bug', agentType: 'opencode' as const }
    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'pnpm test'
    })

    expect(dispatchAttention).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
