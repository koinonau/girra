import type { AiVaultAgent } from '../../shared/ai-vault-types'

// Line builders for the incremental-parse differential tests: each agent gets
// a seed transcript, an appended continuation, and a truncated rewrite, all in
// that agent's real on-disk JSONL record shapes.

export type IncrementalAgentFixture = {
  agent: AiVaultAgent
  fileName: string
  seedLines: string[]
  appendLines: string[]
  truncatedLines: string[]
}

export function piFixture(): IncrementalAgentFixture {
  return {
    agent: 'pi',
    fileName: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.jsonl',
    seedLines: [
      JSON.stringify({
        type: 'session',
        id: 'pi-session-1',
        cwd: '/repo/app',
        timestamp: '2026-05-01T10:00:00.000Z'
      }),
      JSON.stringify({
        type: 'message',
        message: { role: 'user', content: 'pi seed question' },
        timestamp: '2026-05-01T10:00:05.000Z'
      })
    ],
    appendLines: [
      JSON.stringify({
        type: 'model_change',
        modelId: 'pi-2',
        timestamp: '2026-05-01T10:00:30.000Z'
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: 'pi incremental answer',
          usage: { input_tokens: 30, output_tokens: 10 }
        },
        timestamp: '2026-05-01T10:01:00.000Z'
      })
    ],
    truncatedLines: [
      JSON.stringify({ type: 'session', id: 'pi-session-1', timestamp: '2026-05-01T10:00:00.000Z' })
    ]
  }
}

export function allIncrementalAgentFixtures(): IncrementalAgentFixture[] {
  return [piFixture()]
}
