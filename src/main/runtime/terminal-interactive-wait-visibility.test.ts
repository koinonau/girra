// A worker parked on an interactive prompt must be distinguishable from one that is thinking
// or inside a long tool call (STA-4513, STA-3714).
import { makeAgentStatusStoreWiring } from './agent-status-store-wiring.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import {
  createTranscriptPane,
  type TranscriptPaneOptions,
  TRANSCRIPT_PANE_PTY_ID as PTY_ID
} from './agent-transcript-pane-test-harness'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

// Claude Code 2.1.234's own trust screen, which the runtime already matched by shape.
const CLAUDE_TRUST = [
  'Accessing workspace:\n',
  '/private/tmp/repo\n',
  'Quick safety check: Is this a project you created or one you trust?\n',
  '❯ 1. Yes, I trust this folder\n',
  '  2. No, exit\n'
].join('')

function agentStatusOsc(state: string): string {
  return `]9999;${JSON.stringify({ state, prompt: 'ship it', agentType: 'claude' })}`
}

async function createPane(
  options: TranscriptPaneOptions
): Promise<Awaited<ReturnType<typeof createTranscriptPane>>> {
  // Compose the same central hook-store wiring as desktop and orcad so OSC rows exercise the
  // production status path rather than silently disappearing in a bare runtime fixture.
  const statusWiring = makeAgentStatusStoreWiring()
  return createTranscriptPane(options, statusWiring.deps)
}

describe('terminal interactive-wait visibility (STA-4513, STA-3714)', () => {
  describe('prompts the runtime already matched but never surfaced', () => {
    it('surfaces a startup trust screen on the pane, not only on terminal wait', async () => {
      // A pane on its trust screen still wears Girra's tab title; the agent has set none.
      const { runtime, handle } = await createPane({
        paneTitle: 'sta4513-claude',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({
        agentWait: { source: 'prompt-text', reason: 'agent-trust-workspace' }
      })
    })

    it('still lets a live working title clear a stale startup prompt', async () => {
      // Pins the shared authority getTerminalAgentStatus and the agent-prompt send guard
      // already use: for the startup modals, a live non-permission title is the staleness
      // proof, because their text survives in scrollback with no self-dismissal marker.
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })
  })

  describe('hook-reported waits (STA-3714)', () => {
    it('surfaces an agent-reported blocked state with hook provenance', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: agentStatusOsc('waiting')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toMatchObject({
        source: 'hook',
        since: expect.any(Number)
      })
      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({
        agentWait: { source: 'hook' }
      })
    })

    it('reports no wait for a hook-reported working turn', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: agentStatusOsc('working')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })

    it('drops a retained permission row once the agent stops owning the pane', async () => {
      // Why not the title alone: a shell that takes the pane back usually sets something like
      // `user@host: ~/repo`, which no title rule recognizes, and a hook row stays fresh for
      // AGENT_STATUS_STALE_AFTER_MS — half an hour of reporting a dead agent as waiting.
      const { runtime, handle } = await createPane({
        paneTitle: 'jinwoo@host: ~/repo',
        foregroundProcess: 'zsh',
        data: agentStatusOsc('waiting')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })

    it('drops a retained permission row once a shell owns the pane', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'zsh',
        foregroundProcess: 'zsh',
        data: agentStatusOsc('blocked')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })
  })

  it('does not resurrect a startup modal from a restored tail', async () => {
    // The startup prompts keep the timestamp rule: their text lingers in scrollback with no
    // marker for whether it was answered, so restored bytes alone must not mint a wait.
    const { runtime, handle } = await createPane({
      paneTitle: 'sta4513-claude',
      foregroundProcess: 'claude',
      data: ''
    })
    runtime.seedTerminalRestoreTail(PTY_ID, { text: CLAUDE_TRUST })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  it('stops reporting a wait once the pane is no longer running', async () => {
    // Why: the dialog stays at the bottom of a dead pane's tail forever. A worker whose process
    // is gone needs intervention, not an answer, so it must not read as blocked on a human.
    const { runtime, handle } = await createPane({
      paneTitle: 'sta4513-claude',
      foregroundProcess: 'claude',
      data: CLAUDE_TRUST
    })
    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.not.toBeNull()

    runtime.onPtyExit(PTY_ID, 0)

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeUndefined()
  })

  it('does not accrue a probe per poll while the foreground probe wedges', async () => {
    // Why: the timeout abandons the wait, not the request. Without single-flighting, a
    // coordinator watching a wedged remote host adds one live probe on every poll.
    let probes = 0
    const { runtime, handle } = await createPane({
      paneTitle: '✻ Claude Code',
      foregroundProcess: 'claude',
      data: agentStatusOsc('waiting'),
      onForegroundProbe: () => {
        probes += 1
      },
      foregroundProbeHangs: true
    })

    await Promise.all([
      runtime.getTerminalInteractiveWait(handle),
      runtime.getTerminalInteractiveWait(handle),
      runtime.getTerminalInteractiveWait(handle)
    ])

    expect(probes).toBe(1)
  }, 20_000)

  it('leaves the wait unevaluated when the foreground probe wedges', async () => {
    // Why bounded: this probe reaches a PTY controller that can be a remote host. A wedged
    // one must leave the wait unknown, not stall every caller of showTerminal.
    const { runtime, handle } = await createPane({
      paneTitle: '✻ Claude Code',
      foregroundProcess: 'claude',
      data: agentStatusOsc('waiting'),
      foregroundProbeHangs: true
    })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeUndefined()
    const show = (await runtime.showTerminal(handle)) as Record<string, unknown>
    expect('agentWait' in show).toBe(false)
  }, 15_000)

  it('answers undefined rather than "not waiting" for a pane it cannot read', async () => {
    const { runtime } = await createPane({
      paneTitle: 'sta4513-claude',
      foregroundProcess: 'claude',
      data: CLAUDE_TRUST
    })

    await expect(runtime.getTerminalInteractiveWait('term_does_not_exist')).resolves.toBeUndefined()
  })
})
