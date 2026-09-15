// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AGENT_MAP_TIME_FIELDS, AGENT_MAP_TIME_MAX_INDEX } from './agent-map-time-filter'
import { useAgentMapFilters } from './useAgentMapFilters'

describe('useAgentMapFilters', () => {
  it('resets states without clearing the other map filters', () => {
    const hook = renderHook(() => useAgentMapFilters(['claude', 'opencode']))

    act(() => hook.result.current.applyQuickView('stuck'))
    act(() => hook.result.current.resetStates())

    expect([...hook.result.current.states]).toEqual(['attention', 'working', 'done', 'idle'])
    expect(hook.result.current.timeRanges.sinceMessage).toEqual({
      min: 4,
      max: AGENT_MAP_TIME_MAX_INDEX
    })
    expect(hook.result.current.activeCount).toBe(1)
  })

  it('preserves a muted agent type across disappearance and reappearance', () => {
    let agentTypes = ['claude', 'opencode']
    const hook = renderHook(() => useAgentMapFilters(agentTypes))

    act(() => hook.result.current.toggleAgentType('claude'))
    agentTypes = ['opencode']
    hook.rerender()

    expect([...hook.result.current.agentTypes]).toEqual(['opencode'])
    expect(hook.result.current.activeCount).toBe(0)

    agentTypes = ['claude', 'opencode']
    hook.rerender()

    expect([...hook.result.current.agentTypes]).toEqual(['opencode'])
    expect(hook.result.current.activeCount).toBe(1)
  })

  it('enables a newly discovered agent type', () => {
    let agentTypes = ['claude']
    const hook = renderHook(() => useAgentMapFilters(agentTypes))

    agentTypes = ['claude', 'pi']
    hook.rerender()

    expect([...hook.result.current.agentTypes]).toEqual(['claude', 'pi'])
  })

  it('preserves each time-range identity across unrelated facet updates', () => {
    let agentTypes = ['claude', 'opencode']
    const hook = renderHook(() => useAgentMapFilters(agentTypes))
    const ranges = hook.result.current.timeRanges
    const fields = AGENT_MAP_TIME_FIELDS.map((field) => ranges[field])

    act(() => hook.result.current.toggleState('done'))
    act(() => hook.result.current.toggleAgentType('claude'))
    act(() => hook.result.current.setUnreadOnly(true))
    act(() => hook.result.current.setOrchestrationOnly(true))
    agentTypes = ['claude', 'opencode', 'pi']
    hook.rerender()

    expect(hook.result.current.timeRanges).toBe(ranges)
    AGENT_MAP_TIME_FIELDS.forEach((field, index) => {
      expect(hook.result.current.timeRanges[field]).toBe(fields[index])
    })
  })
})
