/**
 * The shared half of the launch route: the renderer's `resolveAgentLaunchRoute` and orchestration's
 * worker-mode decision both answer from these, so a change here moves both surfaces at once.
 */

import { describe, expect, it } from 'vitest'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from './protocol-version'
import {
  agentTabsDefaultToNativeChat,
  prefersStructuredNativeChatByDefault,
  resolveStructuredNativeChatSupport,
  type StructuredNativeChatSupportInput
} from './structured-native-chat-launch-route'

const ON = {
  experimentalNativeChat: true,
  openAgentTabsInChatByDefault: true,
  experimentalStructuredNativeChat: true
}

function support(overrides: Partial<StructuredNativeChatSupportInput> = {}) {
  return resolveStructuredNativeChatSupport({
    agent: 'claude',
    executionHostId: 'local',
    hostCapabilities: [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
    workspaceKind: 'git-worktree',
    ...overrides
  })
}

describe('the settings default', () => {
  it('needs all three toggles for structured, and the first two for native chat', () => {
    expect(prefersStructuredNativeChatByDefault(ON)).toBe(true)
    expect(prefersStructuredNativeChatByDefault({ ...ON, experimentalNativeChat: false })).toBe(
      false
    )
    expect(
      prefersStructuredNativeChatByDefault({ ...ON, openAgentTabsInChatByDefault: false })
    ).toBe(false)
    expect(
      prefersStructuredNativeChatByDefault({ ...ON, experimentalStructuredNativeChat: false })
    ).toBe(false)
    expect(agentTabsDefaultToNativeChat({ ...ON, experimentalStructuredNativeChat: false })).toBe(
      true
    )
  })

  it.each([null, undefined, {}])('reads %s as no preference', (settings) => {
    expect(prefersStructuredNativeChatByDefault(settings)).toBe(false)
    expect(agentTabsDefaultToNativeChat(settings)).toBe(false)
  })
})

describe('per-launch structured feasibility', () => {
  it('supports a local claude launch', () => {
    expect(support({ agent: 'claude' })).toEqual({ supported: true })
  })

  it.each([
    ['a reused PTY agent', { reusesTerminal: true }, 'reused-terminal'],
    ['opencode', { agent: 'opencode' }, 'agent-without-structured-session'],
    ['pi', { agent: 'pi' }, 'agent-without-structured-session'],
    ['claude-agent-teams', { agent: 'claude-agent-teams' }, 'agent-without-structured-session'],
    ['a floating workspace', { workspaceKind: 'floating' }, 'floating-workspace'],
    ['a custom TUI launch', { requiresTuiLaunchCustomization: true }, 'tui-launch-customization'],
    ['an SSH host', { executionHostId: 'ssh:host-a' }, 'remote-execution-host'],
    ['a missing capability', { hostCapabilities: [] }, 'runtime-capability'],
    ['an unanswered host', { hostCapabilities: null }, 'runtime-capability-unknown']
  ] as [string, Partial<StructuredNativeChatSupportInput>, string][])(
    'names %s as the blocker',
    (_name, overrides, blocker) => {
      expect(support(overrides)).toEqual({ supported: false, blocker })
    }
  )

  // The client cannot see whether the host can read a provider child's start time, so the
  // provider is not refused here on platform; agentSession.createSupport answers that at create time.
  it('leaves a Windows claude launch to the executing host', () => {
    expect(support({ agent: 'claude' })).toEqual({ supported: true })
  })

  it('blocks a WSL or repair-required project runtime', () => {
    expect(
      support({
        projectRuntime: {
          status: 'resolved',
          runtime: {
            kind: 'wsl',
            hostPlatform: 'wsl',
            projectId: 'repo-1',
            distro: 'Ubuntu',
            reason: 'project-override',
            cacheKey: 'wsl'
          }
        }
      })
    ).toEqual({ supported: false, blocker: 'project-runtime' })
    expect(
      support({
        projectRuntime: {
          status: 'repair-required',
          repair: {
            projectId: 'repo-1',
            preferredRuntime: { kind: 'wsl', distro: null },
            reason: 'wsl-distro-required',
            source: 'project-override',
            cacheKey: 'repair'
          }
        }
      })
    ).toEqual({ supported: false, blocker: 'project-runtime' })
  })

  it('supports a folder workspace without widening floating scope', () => {
    expect(support({ workspaceKind: 'folder' })).toEqual({ supported: true })
  })
})
