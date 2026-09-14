import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createHookListenerState,
  type HookListenerState
} from './agent-hook-listener/listener-state'
import { normalizeHookPayload } from './agent-hook-listener'
import { PANE_KEY } from './agent-hook-listener-test-harness'

describe('shared agent-hook-listener Claude transcript reads', () => {
  let state: HookListenerState

  beforeEach(() => {
    state = createHookListenerState()
  })

  it('reads the last assistant message behind an oversized line without quadratic copying', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'orca-assistant-huge-line-'))
    const transcriptPath = join(tmpDir, 'transcript.jsonl')
    const originalConcat = Buffer.concat
    let concatenatedBytes = 0
    try {
      // The shared backward reader (readLastTextFromTranscriptOnce) stitches a
      // line spanning many read blocks. Re-joining the carry per block copies
      // O(line^2); the chunk list defers to one join.
      const lineBytes = 2 * 1024 * 1024
      writeFileSync(
        transcriptPath,
        `${JSON.stringify({
          role: 'assistant',
          content: [{ type: 'text', text: 'answer behind a huge line' }]
        })}\n${JSON.stringify({
          role: 'user',
          content: [{ type: 'text', text: 'x'.repeat(lineBytes) }]
        })}\n`
      )

      Buffer.concat = ((list: readonly Uint8Array[], totalLength?: number) => {
        const joined = originalConcat(list as Uint8Array[], totalLength)
        concatenatedBytes += joined.length
        return joined
      }) as typeof Buffer.concat

      const done = normalizeHookPayload(
        state,
        'claude',
        {
          paneKey: PANE_KEY,
          tabId: 'tab-1',
          worktreeId: 'wt',
          env: 'production',
          version: '1',
          payload: { hook_event_name: 'Stop', transcript_path: transcriptPath }
        },
        'production'
      )

      expect(done?.payload.lastAssistantMessage).toBe('answer behind a huge line')
      // Linear copies once (~lineBytes); the quadratic form copied many times that.
      expect(concatenatedBytes).toBeLessThan(lineBytes * 4)
    } finally {
      Buffer.concat = originalConcat
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('trims surrounding whitespace from extracted prompt text', () => {
    const event = normalizeHookPayload(
      state,
      'claude',
      {
        paneKey: PANE_KEY,
        payload: { hook_event_name: 'UserPromptSubmit', prompt: '   hi   ' }
      },
      'production'
    )
    expect(event).not.toBeNull()
    expect(event!.payload.prompt).toBe('hi')
  })
})
