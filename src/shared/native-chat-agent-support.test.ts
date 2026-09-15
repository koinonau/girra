import { describe, expect, it } from 'vitest'
import {
  isNativeChatSupportedAgent,
  resolveNativeChatTranscriptAgent
} from './native-chat-agent-support'

describe('resolveNativeChatTranscriptAgent', () => {
  it('reads Claude transcripts and rejects everything else', () => {
    expect(resolveNativeChatTranscriptAgent('claude')).toBe('claude')
    expect(resolveNativeChatTranscriptAgent('opencode')).toBeNull()
    expect(resolveNativeChatTranscriptAgent(null)).toBeNull()
    expect(resolveNativeChatTranscriptAgent(undefined)).toBeNull()
  })
})

describe('isNativeChatSupportedAgent', () => {
  it('recognizes the parseable agents and rejects unknown / nullish input', () => {
    expect(isNativeChatSupportedAgent('claude')).toBe(true)
    expect(isNativeChatSupportedAgent('pi')).toBe(false)
    expect(isNativeChatSupportedAgent(null)).toBe(false)
    expect(isNativeChatSupportedAgent(undefined)).toBe(false)
  })
})
