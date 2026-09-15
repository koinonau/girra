import { describe, expect, it, vi } from 'vitest'
import { createAgentCompletionCoordinator } from './agent-completion-coordinator'
import {
  createDeferred,
  flushAsyncTicks,
  HOOK_DONE_QUIET_MS,
  processResult,
  useAgentCompletionCoordinatorLifecycle
} from './agent-completion-coordinator-test-harness'
import type { RuntimeTerminalProcessInspection } from '@/runtime/runtime-terminal-inspection'

describe('agent completion coordinator', () => {
  useAgentCompletionCoordinatorLifecycle()

  it('suppresses same-turn title completion after a hook completion already notified', () => {
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'working',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.observeClassifiedTitleCompletion('claude done')
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledWith(
      'claude',
      expect.objectContaining({
        source: 'hook',
        quietedHookDone: true,
        agentStatus: expect.objectContaining({
          state: 'done',
          agentType: 'claude'
        })
      })
    )
  })

  it('ignores stale working title state after a hook completion already notified', () => {
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.observeTitle('⠋ claude')
    coordinator.observeTitle('claude done')

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledWith('claude')
  })

  it('suppresses delayed title completion after process inspection changes sessions', async () => {
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(async () => processResult('claude')),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    coordinator.observeClassifiedTitleCompletion('claude done')

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledWith('claude')
  })

  it('suppresses late process-exit backstop after process inspection follows hook completion', async () => {
    let foregroundProcess: string | null = 'claude'
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(async () => processResult(foregroundProcess)),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    foregroundProcess = null
    vi.advanceTimersByTime(750)
    await flushAsyncTicks()

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledWith('claude')
  })

  it('suppresses process-exit in another coordinator after a hook completion notified', async () => {
    const paneKey = 'tab-1:leaf-1'
    const dispatchCompletion = vi.fn()
    const hookCoordinator = createAgentCompletionCoordinator({
      paneKey,
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(async () => processResult(null)),
      dispatchCompletion,
      isLive: () => true
    })

    hookCoordinator.observeHookStatus({
      state: 'working',
      prompt: 'say OK only',
      agentType: 'claude'
    })
    hookCoordinator.observeHookStatus({
      state: 'done',
      prompt: 'say OK only',
      agentType: 'claude',
      stateStartedAt: 1_700_000_000_000
    })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)

    let result = processResult('claude')
    const processCoordinator = createAgentCompletionCoordinator({
      paneKey,
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(async () => result),
      dispatchCompletion,
      isLive: () => true
    })

    processCoordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()

    result = processResult('zsh', false)
    vi.advanceTimersByTime(750)
    await flushAsyncTicks()
    vi.advanceTimersByTime(750)
    await flushAsyncTicks()

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)

    result = processResult('claude')
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    result = processResult('zsh', false)
    vi.advanceTimersByTime(750)
    await flushAsyncTicks()
    vi.advanceTimersByTime(750)
    await flushAsyncTicks()

    expect(dispatchCompletion).toHaveBeenCalledTimes(2)
  })

  it('keeps duplicate done-only hooks inside replay guard suppressed after process inspection', async () => {
    const inspection = createDeferred<RuntimeTerminalProcessInspection>()
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(() => inspection.promise),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    inspection.resolve(processResult('claude'))
    await flushAsyncTicks()
    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
  })

  it('can require a fresh working signal after completion state reset', () => {
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.resetCompletionState({ requireFreshWorking: true })
    coordinator.observeClassifiedTitleCompletion('claude done')
    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    expect(dispatchCompletion).toHaveBeenCalledTimes(1)

    coordinator.observeHookStatus({
      state: 'working',
      prompt: '',
      agentType: 'claude'
    })
    coordinator.observeHookStatus({
      state: 'done',
      prompt: '',
      agentType: 'claude'
    })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).toHaveBeenCalledTimes(2)
  })

  it('ignores process inspections that resolve after completion state reset', async () => {
    const inspection = createDeferred<RuntimeTerminalProcessInspection>()
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess: vi.fn(() => inspection.promise),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    coordinator.resetCompletionState({ requireFreshWorking: true })
    inspection.resolve(processResult('claude'))
    await flushAsyncTicks()
    coordinator.observeTitle('⠋ experimental-agent-observability')
    coordinator.observeTitle('experimental-agent-observability')

    expect(dispatchCompletion).not.toHaveBeenCalled()
  })

  it('starts a fresh pending-title inspection after stale inspection resolves', async () => {
    const firstInspection = createDeferred<RuntimeTerminalProcessInspection>()
    const secondInspection = createDeferred<RuntimeTerminalProcessInspection>()
    const inspectProcess = vi
      .fn()
      .mockReturnValueOnce(firstInspection.promise)
      .mockReturnValueOnce(secondInspection.promise)
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      getSettings: () => null,
      inspectProcess,
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.startProcessTracking()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    coordinator.resetCompletionState({ requireFreshWorking: true })
    coordinator.observeTitle('⠋ experimental-agent-observability')
    coordinator.observeTitle('experimental-agent-observability')
    firstInspection.resolve(processResult('claude'))
    await flushAsyncTicks()
    vi.advanceTimersByTime(2_000)
    await flushAsyncTicks()
    secondInspection.resolve(processResult('claude'))
    await flushAsyncTicks()

    expect(inspectProcess).toHaveBeenCalledTimes(2)
    expect(dispatchCompletion).toHaveBeenCalledWith('experimental-agent-observability')
  })
})
