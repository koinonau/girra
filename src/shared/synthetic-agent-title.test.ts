import { describe, expect, it } from 'vitest'
import {
  getSyntheticAgentTerminalTitle,
  isSyntheticAgentPermissionTitle,
  shouldDriveSyntheticAgentTitleFromHook
} from './synthetic-agent-title'

describe('synthetic agent titles', () => {
  it.each(['Codex - action required', ' Pi - action required '])(
    'recognizes the generated permission label %s',
    (title) => {
      expect(isSyntheticAgentPermissionTitle(title)).toBe(true)
    }
  )

  it.each([
    'π ! approve command',
    'OpenCode - action required',
    'Codex ready',
    'Codex - action required for deployment'
  ])('keeps native and contextual titles outside generated permission suppression: %s', (title) => {
    expect(isSyntheticAgentPermissionTitle(title)).toBe(false)
  })

  it('provides terminal-state titles for Codex hook completion', () => {
    expect(getSyntheticAgentTerminalTitle('codex', 'done')).toBe('Codex ready')
    expect(getSyntheticAgentTerminalTitle('codex', 'waiting')).toBe('Codex - action required')
  })

  it('does not synthesize Codex working titles over Codex native spinner titles', () => {
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'done')).toBe(true)
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
  })
})
