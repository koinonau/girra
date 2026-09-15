import { stat } from 'node:fs/promises'
import {
  createSessionParseStats,
  parseAgentSessionFileCached,
  type SessionParseStats
} from '../ai-vault/session-scanner-parse-cache'
import type { SessionFileCandidate } from '../ai-vault/session-scanner-types'

// Transcript builders shared by the session-search store tests; each file owns
// its temp directories, this module only shapes records and drives the parser.

export const CLAUDE_SESSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const RECORD_EPOCH_MS = 1740000000000

export function recordTimestamp(index: number): string {
  return new Date(RECORD_EPOCH_MS + index * 60_000).toISOString()
}

export function userRecord(
  index: number,
  content: unknown,
  sessionId = CLAUDE_SESSION_ID,
  cwd = '/repo/app'
): string {
  return JSON.stringify({
    type: 'user',
    sessionId,
    timestamp: recordTimestamp(index),
    cwd,
    gitBranch: 'main',
    message: { role: 'user', content }
  })
}

export function assistantRecord(
  index: number,
  content: unknown,
  sessionId = CLAUDE_SESSION_ID
): string {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    timestamp: recordTimestamp(index),
    message: { role: 'assistant', model: 'claude-fable-5', content }
  })
}

export async function sessionCandidate(
  agent: SessionFileCandidate['agent'],
  path: string
): Promise<SessionFileCandidate> {
  const fileStat = await stat(path)
  return {
    agent,
    file: {
      path,
      mtimeMs: fileStat.mtimeMs,
      modifiedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size,
      dev: fileStat.dev,
      ino: fileStat.ino
    }
  }
}

export async function parseTranscript(
  path: string,
  agent: SessionFileCandidate['agent'] = 'claude'
): Promise<{ stats: SessionParseStats }> {
  const stats = createSessionParseStats()
  await parseAgentSessionFileCached(await sessionCandidate(agent, path), process.platform, stats)
  return { stats }
}

/** Minimal Claude turn: one user prompt, one tool call, and its result. */
export function claudeToolTurnLines(command: string, output: string, prompt: string): string[] {
  return [
    userRecord(0, prompt),
    assistantRecord(1, [{ type: 'tool_use', id: 'call-1', name: 'Bash', input: { command } }]),
    userRecord(2, [{ type: 'tool_result', tool_use_id: 'call-1', content: output }])
  ]
}
