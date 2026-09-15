import { describe, expect, it } from 'vitest'
import { getAgentModelProbeSpec } from './agent-model-probe-spec'
import { getCommitMessageAgentSpec, listCommitMessageAgentIds } from './commit-message-agent-spec'

describe('getAgentModelProbeSpec', () => {
  it('aliases commit-message agents by identity rather than copying them', () => {
    // A lossy adapter here would silently drop fields like
    // `modelDiscovery.stdinPayload` and break Claude discovery.
    for (const id of listCommitMessageAgentIds()) {
      expect(getAgentModelProbeSpec(id)).toBe(getCommitMessageAgentSpec(id))
    }
  })

  it('is undefined for an agent outside the commit-message registry', () => {
    expect(getAgentModelProbeSpec('claude-agent-teams')).toBeUndefined()
  })
})
