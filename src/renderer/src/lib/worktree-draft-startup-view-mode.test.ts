import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { resolveBackendDraftStartup } from './worktree-draft-startup-view-mode'

type AppState = ReturnType<typeof useAppStore.getState>

const initialSettings = useAppStore.getState().settings!

const request = {
  repoId: 'repo-1',
  startup: { launchCommand: 'claude' },
  launchDraftPrompt: 'https://github.com/o/r/issues/12'
} as never

function viewModeFor(agent: string): string | undefined {
  const startup = resolveBackendDraftStartup({ ...(request as object), agent } as never) as
    | { viewMode?: string }
    | undefined
  return startup?.viewMode
}

beforeEach(() => {
  useAppStore.setState({
    settings: {
      ...initialSettings,
      experimentalNativeChat: true,
      openAgentTabsInChatByDefault: true
    }
  })
})

afterEach(() => {
  useAppStore.setState({ settings: initialSettings } as Partial<AppState>)
})

describe('resolveBackendDraftStartup', () => {
  it('opens a mirrorable draft in chat for a native-chat agent', () => {
    expect(viewModeFor('claude')).toBe('chat')
  })

  it('keeps an agent without native chat in the terminal view', () => {
    expect(viewModeFor('opencode')).toBe('terminal')
  })
})
