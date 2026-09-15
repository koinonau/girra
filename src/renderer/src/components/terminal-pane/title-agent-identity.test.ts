import { describe, expect, it } from 'vitest'
import { titleHasExplicitAgentIdentity } from './title-agent-identity'

describe('titleHasExplicitAgentIdentity', () => {
  it('recognizes executable titles through the shared token matcher', () => {
    expect(titleHasExplicitAgentIdentity('claude.exe ready')).toBe(true)
    expect(titleHasExplicitAgentIdentity('opencode.cmd working')).toBe(true)
    expect(titleHasExplicitAgentIdentity('pi.cmd working')).toBe(true)
  })

  it('rejects path and compound fragments', () => {
    expect(titleHasExplicitAgentIdentity('C:\\work\\claude.exe\\ready')).toBe(false)
    expect(titleHasExplicitAgentIdentity('opencode-fixtures ready')).toBe(false)
    expect(titleHasExplicitAgentIdentity('pi-fixtures ready')).toBe(false)
  })
})
