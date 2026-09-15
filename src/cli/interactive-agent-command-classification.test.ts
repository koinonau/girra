import { describe, expect, it } from 'vitest'

import { shouldUseRendererBackedInteractiveTerminal } from './interactive-agent-command-classification'

describe('shouldUseRendererBackedInteractiveTerminal', () => {
  it('uses renderer-backed terminal creation for interactive Claude sessions', () => {
    expect(shouldUseRendererBackedInteractiveTerminal('claude')).toBe(true)
    expect(shouldUseRendererBackedInteractiveTerminal('claude --prefill "review this"')).toBe(true)
    expect(shouldUseRendererBackedInteractiveTerminal('/opt/anthropic/bin/claude')).toBe(true)
    expect(shouldUseRendererBackedInteractiveTerminal('claude.cmd')).toBe(true)
    expect(shouldUseRendererBackedInteractiveTerminal('env ANTHROPIC_BASE_URL=test claude')).toBe(
      true
    )
    expect(
      shouldUseRendererBackedInteractiveTerminal('env -u DEBUG FOO=1 --unset=BAR claude')
    ).toBe(true)
  })

  it('keeps one-shot Claude commands on the background path', () => {
    expect(shouldUseRendererBackedInteractiveTerminal('claude -p "summarize"')).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('claude --print "summarize"')).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('claude --print=json')).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('claude --help')).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('claude --version')).toBe(false)
  })

  it('ignores other commands', () => {
    expect(shouldUseRendererBackedInteractiveTerminal(undefined)).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('opencode')).toBe(false)
    expect(shouldUseRendererBackedInteractiveTerminal('npm exec claude')).toBe(false)
  })
})
