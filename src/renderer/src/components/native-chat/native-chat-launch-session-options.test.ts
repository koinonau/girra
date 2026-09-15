import { describe, expect, it } from 'vitest'
import { resolveInitialNativeChatSessionOptions } from './native-chat-launch-session-options'

const settings = {
  experimentalNativeChat: true,
  openAgentTabsInChatByDefault: true,
  nativeChatSessionOptions: {
    claude: {
      model: 'opus',
      valuesByModel: { opus: { effort: 'medium' } }
    }
  }
}

describe('resolveInitialNativeChatSessionOptions', () => {
  it('omits native-chat preferences from terminal-default launches', () => {
    expect(
      resolveInitialNativeChatSessionOptions(
        { ...settings, openAgentTabsInChatByDefault: false },
        { agent: 'claude' }
      )
    ).toBeUndefined()
  })

  it('applies native-chat preferences when the launch resolves to chat', () => {
    expect(resolveInitialNativeChatSessionOptions(settings, { agent: 'claude' })).toEqual({
      model: 'opus',
      effort: 'medium'
    })
  })

  it('omits preferences when a draft forces the initial view back to terminal', () => {
    expect(
      resolveInitialNativeChatSessionOptions(settings, {
        agent: 'claude',
        promptDelivery: 'draft',
        launchDraftText: 'one\u2028two'
      })
    ).toBeUndefined()
  })
})
