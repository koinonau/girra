import { describe, expect, it } from 'vitest'
import {
  getSyntheticAgentTerminalTitle,
  isSyntheticAgentPermissionTitle,
  shouldDriveSyntheticAgentTitleFromHook
} from './synthetic-agent-title'

describe('synthetic agent titles', () => {
  it.each(['Pi - action required', ' Pi - action required '])(
    'recognizes the generated permission label %s',
    (title) => {
      expect(isSyntheticAgentPermissionTitle(title)).toBe(true)
    }
  )

  it.each([
    'π ! approve command',
    'OpenCode - action required',
    'Pi ready',
    'Pi - action required for deployment'
  ])('keeps native and contextual titles outside generated permission suppression: %s', (title) => {
    expect(isSyntheticAgentPermissionTitle(title)).toBe(false)
  })

  it('does not synthesize OpenCode titles over native session titles', () => {
    expect(getSyntheticAgentTerminalTitle('opencode', 'done')).toBeNull()
    expect(getSyntheticAgentTerminalTitle('opencode', 'waiting')).toBeNull()
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'done')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'waiting')).toBe(false)
  })

  it('provides Pi titles for hook-driven status updates', () => {
    expect(getSyntheticAgentTerminalTitle('pi', 'done')).toBe('Pi ready')
    expect(getSyntheticAgentTerminalTitle('pi', 'waiting')).toBe('Pi - action required')
    expect(shouldDriveSyntheticAgentTitleFromHook('pi', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('pi', 'done')).toBe(true)
  })

  it('synthesizes no title for an agent without a profile', () => {
    expect(getSyntheticAgentTerminalTitle('claude', 'done')).toBeNull()
  })
})
