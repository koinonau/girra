import { describe, expect, it } from 'vitest'
import { resolveTabAgentFromSignals } from './tab-agent-from-signals'

// The tab icon is a pane's IDENTITY, not its activity state: a hook record
// identifies the pane whether the agent is mid-turn (live) or idle (done). These
// pin that separation so identity can't collapse back into the (non-
// distinguishing) title layer.
describe('resolveTabAgentFromSignals — identity vs liveness', () => {
  it('surfaces the focused idle identity from the record, not the title', () => {
    // Agent went idle between turns; the title names no agent. Identity still
    // comes from the pane's own done-hook record.
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: 'Terminal',
        hookAgent: null,
        focusedCompletedHookAgent: 'opencode',
        launchAgent: undefined
      })
    ).toBe('opencode')
  })

  it('ranks the focused idle identity above a hibernated session and launch bootstrap', () => {
    // The agent that actually ran and idled here beats both a hibernation record
    // and stale launch intent.
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: 'Terminal',
        hookAgent: null,
        focusedCompletedHookAgent: 'opencode',
        sleepingSessionAgent: 'claude',
        launchAgent: 'pi'
      })
    ).toBe('opencode')
  })

  it('never lets a title override a live hook (ground truth)', () => {
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: '✳ Claude Code',
        hookAgent: 'opencode',
        launchAgent: undefined
      })
    ).toBe('opencode')
  })

  it('lets a different-group title reclaim a reused idle pane without launch metadata', () => {
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: '✳ Claude Code',
        hookAgent: null,
        focusedCompletedHookAgent: 'opencode',
        launchAgent: undefined
      })
    ).toBe('claude')
  })

  it('keeps a launchAgent-less pane with a live Pi hook stable on Pi', () => {
    // A launchless pane whose live hook reports Pi resolves to Pi and stays Pi
    // when the hook clears (the completed record is Pi too).
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: '⠋ Pi',
        hookAgent: 'pi',
        launchAgent: undefined
      })
    ).toBe('pi')
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: '⠋ Pi',
        hookAgent: null,
        focusedCompletedHookAgent: 'pi',
        launchAgent: undefined
      })
    ).toBe('pi')
  })

  it('keeps a sibling idle identity when the focused pane returns to its shell', () => {
    // Focused pane's local shell-exit evidence must not clear the sibling's idle
    // identity — the sibling agent is still there.
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: false,
        title: 'zsh',
        hookAgent: null,
        focusedCompletedHookAgent: 'claude',
        siblingCompletedHookAgent: 'opencode',
        launchAgent: undefined
      })
    ).toBe('opencode')
  })

  it('does not let a sibling pane re-own the focused pane ambiguous Pi title', () => {
    // A split-pane sibling's agent says nothing about the focused pane; its own
    // Pi title must stay Pi.
    expect(
      resolveTabAgentFromSignals({
        hasObservedAgentSignal: true,
        isRemote: true,
        title: '⠋ Pi',
        hookAgent: null,
        focusedCompletedHookAgent: null,
        siblingCompletedHookAgent: 'opencode',
        launchAgent: undefined
      })
    ).toBe('pi')
  })

  it('does not flash the exited agent before a hookless reuse title reclaims on mount', () => {
    // hasObservedAgentSignal starts false for one mount commit; a completed hook
    // is itself activity evidence, so the reuse title reclaims immediately
    // instead of flashing the prior agent's idle identity. (claude ran+idled,
    // then a hookless opencode reused the pane and emits its own title.)
    const onMount = resolveTabAgentFromSignals({
      hasObservedAgentSignal: false,
      isRemote: false,
      title: '⠋ OpenCode',
      hookAgent: null,
      focusedCompletedHookAgent: 'claude',
      launchAgent: undefined
    })
    const afterObserved = resolveTabAgentFromSignals({
      hasObservedAgentSignal: true,
      isRemote: false,
      title: '⠋ OpenCode',
      hookAgent: null,
      focusedCompletedHookAgent: 'claude',
      launchAgent: undefined
    })
    expect(onMount).toBe('opencode')
    expect(afterObserved).toBe('opencode')
  })
})
