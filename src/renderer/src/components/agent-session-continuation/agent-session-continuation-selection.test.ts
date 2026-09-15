import { describe, expect, it } from 'vitest'
import { chooseInitialContinuationAgent } from './agent-session-continuation-selection'

describe('chooseInitialContinuationAgent', () => {
  it('keeps the source Agent when it is available', () => {
    expect(
      chooseInitialContinuationAgent({
        availableAgents: ['opencode', 'claude'],
        sourceAgent: 'claude',
        defaultAgent: 'opencode'
      })
    ).toBe('claude')
  })

  it('falls back to the saved default and then the first available Agent', () => {
    expect(
      chooseInitialContinuationAgent({
        availableAgents: ['opencode', 'claude'],
        sourceAgent: 'pi',
        defaultAgent: 'claude'
      })
    ).toBe('claude')
    expect(
      chooseInitialContinuationAgent({
        availableAgents: ['opencode'],
        sourceAgent: null,
        defaultAgent: 'blank'
      })
    ).toBe('opencode')
  })
})
