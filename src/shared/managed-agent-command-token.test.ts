import { describe, expect, it } from 'vitest'
import {
  extractExecutableToken,
  hasPathSeparatorToken,
  isSafeExecutableBasename,
  isSafeOverrideExecutableToken
} from './managed-agent-command-token'

describe('managed agent command tokens', () => {
  it('extracts quoted and escaped POSIX executable paths', () => {
    expect(
      extractExecutableToken('"/opt/Agent Tools/opencode" --flag', { platform: 'linux' })
    ).toBe('/opt/Agent Tools/opencode')
    expect(
      extractExecutableToken('/opt/Agent\\ Tools/opencode --flag', { platform: 'linux' })
    ).toBe('/opt/Agent Tools/opencode')
  })

  it('preserves Windows path separators', () => {
    expect(
      extractExecutableToken('"C:\\Program Files\\Claude\\claude.exe" --flag', {
        platform: 'win32'
      })
    ).toBe('C:\\Program Files\\Claude\\claude.exe')
  })

  it('distinguishes safe basenames from path tokens', () => {
    expect(isSafeExecutableBasename('claude-code_1.2+')).toBe(true)
    expect(isSafeExecutableBasename('../claude')).toBe(false)
    expect(isSafeExecutableBasename('claude;echo')).toBe(false)
    expect(hasPathSeparatorToken('C:\\Tools\\claude.exe')).toBe(true)
    expect(hasPathSeparatorToken('/opt/opencode')).toBe(true)
    expect(hasPathSeparatorToken('opencode')).toBe(false)
  })

  it('rejects traversal, control characters, and shell syntax in override paths', () => {
    expect(isSafeOverrideExecutableToken('~/bin/opencode')).toBe(true)
    expect(isSafeOverrideExecutableToken('C:\\Program Files\\Claude\\claude.exe')).toBe(true)
    expect(isSafeOverrideExecutableToken('../bin/opencode')).toBe(false)
    expect(isSafeOverrideExecutableToken('/opt/opencode;echo')).toBe(false)
    expect(isSafeOverrideExecutableToken('/opt/opencode\0')).toBe(false)
  })
})
