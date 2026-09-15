import { describe, it, expect } from 'vitest'
import { canSwitchNativeChatView, canToggleNativeChat } from './native-chat-availability'

describe('canToggleNativeChat', () => {
  it('allows a terminal launched with a supported coding agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(true)
  })

  it('allows a terminal with a live detected supported agent but no launchAgent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: 'claude'
      })
    ).toBe(true)
  })

  it('allows a terminal with a resolved title/foreground supported agent before hooks arrive', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        resolvedAgent: 'claude'
      })
    ).toBe(true)
  })

  it('allows an existing chat view to toggle back after live signals are gone', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        isChatViewMode: true
      })
    ).toBe(true)
  })

  it.each(['pi', 'opencode'] as const)('rejects unsupported agent %s detected live', (agent) => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: agent
      })
    ).toBe(false)
  })

  it('rejects a stale supported title when live detection found an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: 'opencode',
        resolvedAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects stale launch metadata when live detection found an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude',
        detectedAgent: 'opencode'
      })
    ).toBe(false)
  })

  it('rejects a stale supported title when launch metadata names an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'opencode',
        resolvedAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects otherwise eligible terminals while the experimental flag is off', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: false,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects a plain shell terminal with no agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: null
      })
    ).toBe(false)
  })

  it('rejects a plain shell terminal with everything omitted', () => {
    expect(
      canToggleNativeChat({ experimentalNativeChatEnabled: true, contentType: 'terminal' })
    ).toBe(false)
  })

  it('rejects an editor tab even if a supported agent hint were somehow present', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'editor',
        launchAgent: 'claude',
        detectedAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects a browser tab', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'browser',
        detectedAgent: 'claude'
      })
    ).toBe(false)
  })
})

describe('canSwitchNativeChatView', () => {
  it('allows bridge chat to expose a terminal/chat switcher', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(true)
  })

  it('keeps structured sessions free of terminal/chat switchers', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude',
        structuredSessionId: 'thread-1'
      })
    ).toBe(false)
  })

  it('keeps structured sessions hidden even when toggling back', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        isChatViewMode: true,
        structuredSessionId: 'thread-1'
      })
    ).toBe(false)
  })
})
