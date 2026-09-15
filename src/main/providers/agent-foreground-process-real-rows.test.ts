import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { ProcessTableRow } from '../../shared/process-table-snapshot'
import { resolveAgentForegroundProcessFromPs } from './agent-foreground-process'

type CapturedRun = {
  agent: string
  shellPid: number
  rows: ProcessTableRow[]
}

describe('real foreground process captures', () => {
  it('resolves the captured agents that still have a launch profile', () => {
    const captured = JSON.parse(
      gunzipSync(readFileSync(join(__dirname, '__fixtures__', 'real-agent-rows.json.gz'))).toString(
        'utf8'
      )
    ) as CapturedRun[]

    expect(
      captured
        .filter(({ agent }) => ['claude', 'codex', 'opencode'].includes(agent))
        .map(({ agent, shellPid, rows }) => ({
          agent,
          processName: resolveAgentForegroundProcessFromPs(rows, shellPid)
        }))
    ).toEqual([
      { agent: 'claude', processName: 'claude' },
      { agent: 'codex', processName: 'codex' },
      { agent: 'opencode', processName: 'opencode' }
    ])
  })
})
