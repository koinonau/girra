import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendFollowupPromptWhenAgentReady } from './agent-followup-delivery'
import {
  inspectRuntimeTerminalProcess,
  sendRuntimePtyInputVerified
} from '@/runtime/runtime-terminal-inspection'
import { TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'

vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  inspectRuntimeTerminalProcess: vi.fn(),
  sendRuntimePtyInputVerified: vi.fn()
}))

// Agents that deliver their prompt over stdin after the process starts can surface
// an interpreter foreground comm (node/python) instead of the agent's own name.
const INTERPRETER_WRAPPED_AGENTS = [
  {
    agent: 'claude-agent-teams',
    expectedProcess: TUI_AGENT_CONFIG['claude-agent-teams'].expectedProcess,
    wrapper: 'node'
  }
] as const

describe('sendFollowupPromptWhenAgentReady — interpreter-wrapped agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('globalThis', globalThis)
    // Deliver the prompt write eagerly so the test does not depend on retries.
    vi.mocked(sendRuntimePtyInputVerified).mockResolvedValue(true)
  })

  it('sanity: config keeps Agent Teams as stdin-after-start', () => {
    expect(TUI_AGENT_CONFIG['claude-agent-teams'].promptInjectionMode).toBe('stdin-after-start')
  })

  for (const { agent, expectedProcess, wrapper } of INTERPRETER_WRAPPED_AGENTS) {
    it(`types the prompt once ${agent} is up behind a ${wrapper} wrapper with a live child`, async () => {
      // The wrapped agent is running: foreground comm is the interpreter and the
      // PTY has a non-shell child. The exact agent name never appears.
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: wrapper,
        hasChildProcesses: true
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(true)
      expect(sendRuntimePtyInputVerified).toHaveBeenCalledWith(null, 'pty-1', 'ship it\r')
    })

    it(`still refuses to type into a bare ${agent} shell foreground`, async () => {
      // No agent yet: foreground is a plain shell with no non-shell child. The
      // guard must NOT write user text into an arbitrary shell.
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: 'zsh',
        hasChildProcesses: false
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(false)
      expect(sendRuntimePtyInputVerified).not.toHaveBeenCalled()
    })

    it(`refuses to type into a ${agent} wrapper without a live child`, async () => {
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: wrapper,
        hasChildProcesses: false
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(false)
      expect(sendRuntimePtyInputVerified).not.toHaveBeenCalled()
    })
  }

  it('types immediately when the resolver already returns the agent name (local ps path)', async () => {
    // On local desktop the ps-table resolver usually resolves node to claude
    // before we poll; the exact-match path must keep working.
    vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
      foregroundProcess: 'claude',
      hasChildProcesses: true
    })

    const delivered = await sendFollowupPromptWhenAgentReady({
      ptyId: 'pty-1',
      expectedProcess: 'claude',
      prompt: 'ship it',
      settings: null
    })

    expect(delivered).toBe(true)
    expect(sendRuntimePtyInputVerified).toHaveBeenCalledWith(null, 'pty-1', 'ship it\r')
  })
})
