import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { RuntimeClient } from '../../../src/cli/runtime-client'
import { encodeClaudeProjectPath } from '../../../src/main/ai-vault/claude-project-dir-encoding'
import { DEFAULT_LOCAL_ORCA_PROFILE_ID } from '../../../src/shared/orca-profiles'
import type {
  RuntimeTerminalListResult,
  RuntimeTerminalSummary
} from '../../../src/shared/runtime-types'
import { buildFakeAgentCommandOverride } from './fake-agent-command-override'
import { FAKE_AGENT_PASTE_END_SCANNER_SOURCE } from './fake-agent-paste-end-scanner'

const fakeCliDir = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-retired-worker-'))
const lifecycleLedgerPath = path.join(fakeCliDir, 'worker-lifecycle.jsonl')
export const completedWorkerFakeClaudeCommand = buildFakeAgentCommandOverride(
  path.join(fakeCliDir, process.platform === 'win32' ? 'claude.cmd' : 'claude')
)
const fakeClaudeSource = `
const { appendFileSync } = require('node:fs')
const ledger = process.env.ORCA_E2E_WORKER_LIFECYCLE_LEDGER
const append = (event) => appendFileSync(ledger, JSON.stringify({ pid: process.pid, ...event }) + '\\n')
const args = process.argv.slice(2)
// Why: Orca's hidden Claude usage probe also runs claude from PATH; keep it out of the spawn ledger.
if (require('node:path').basename(process.cwd()) === 'rate-limit-pty-cwd') process.exit(0)
append({ event: 'spawn', args })
process.stdout.write('\\u001b]0;Claude ready\\u0007Claude Code\\n')
${FAKE_AGENT_PASTE_END_SCANNER_SOURCE}
process.stdin.on('data', (chunk) => {
  const input = chunk.toString()
  const pasteEndScan = scanFakeAgentPasteEnd(fakeAgentPasteEndTail, input)
  fakeAgentPasteEndTail = pasteEndScan.tail
  if (pasteEndScan.pasteEndOffset !== null) {
    process.stdout.write('\\x1b[?25h')
  }
  append({ event: 'input', input })
  if (input.includes('ORCA_E2E_EXIT_AFTER_DONE')) {
    append({ event: 'normal-exit' })
    process.exit(0)
  }
  fakeAgentMaybeAck(pasteEndScan, input, (mode) => {
    append({ event: 'ack', mode })
    const message = mode === 'bracketed' ? 'ACK' : 'PASTE_PROTOCOL_ERROR'
    process.stdout.write('\\u001b]0;Claude working\\u0007' + message + '\\n')
    setTimeout(() => process.stdout.write('\\u001b]0;Claude ready\\u0007'), 10)
  })
})
process.stdin.setRawMode?.(true)
process.stdin.resume()
setInterval(() => {}, 60_000)
`

function installCompletedWorkerFakeClaude(): void {
  mkdirSync(fakeCliDir, { recursive: true })
  if (process.platform === 'win32') {
    writeFileSync(path.join(fakeCliDir, 'fake-claude.js'), fakeClaudeSource)
    writeFileSync(
      path.join(fakeCliDir, 'claude.cmd'),
      '@echo off\r\nnode "%~dp0\\fake-claude.js" %*\r\n'
    )
  } else {
    const executable = path.join(fakeCliDir, 'claude')
    writeFileSync(executable, `#!/usr/bin/env node\n${fakeClaudeSource}`)
    chmodSync(executable, 0o755)
  }
}

installCompletedWorkerFakeClaude()

export const completedWorkerLaunchEnv = {
  PATH: `${fakeCliDir}${path.delimiter}${process.env.PATH ?? ''}`,
  ORCA_E2E_WORKER_LIFECYCLE_LEDGER: lifecycleLedgerPath
}

export type LifecycleEvent = {
  pid: number
  event: 'spawn' | 'input' | 'ack' | 'normal-exit'
  args?: string[]
  input?: string
  mode?: 'bracketed' | 'unbracketed'
}

export type TerminalIdentity = Pick<
  RuntimeTerminalSummary,
  'handle' | 'incarnationId' | 'leafId' | 'ptyId' | 'tabId' | 'worktreeId'
>

export function clearCompletedWorkerLedger(): void {
  // Another spec can clean up this cached fixture before the next test uses it.
  installCompletedWorkerFakeClaude()
  rmSync(lifecycleLedgerPath, { force: true })
}

export function cleanupCompletedWorkerFixture(): void {
  rmSync(fakeCliDir, { recursive: true, force: true })
}

export function readCompletedWorkerLedger(): LifecycleEvent[] {
  if (!existsSync(lifecycleLedgerPath)) {
    return []
  }
  const contents = readFileSync(lifecycleLedgerPath, 'utf8')
  const lastCompleteLine = contents.lastIndexOf('\n')
  if (lastCompleteLine === -1) {
    return []
  }
  return contents
    .slice(0, lastCompleteLine)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LifecycleEvent)
}

export function readCompletedWorkerDispatchCapability(): string | null {
  const input = readCompletedWorkerLedger()
    .filter((event) => event.event === 'input')
    .map((event) => event.input ?? '')
    .join('')
  return input.match(/--dispatch-capability\s+(\S+)/)?.[1] ?? null
}

export function runBuiltOrcaCli(
  args: string[],
  options: { userDataDir: string; cwd: string }
): unknown {
  const {
    ORCA_ENVIRONMENT: _environment,
    ORCA_PAIRING_CODE: _pairingCode,
    ORCA_USER_DATA_PATH: _userDataPath,
    ...cleanEnv
  } = process.env
  void _environment
  void _pairingCode
  void _userDataPath
  const output = execFileSync(
    process.execPath,
    [path.join(process.cwd(), 'out', 'cli', 'index.js'), ...args],
    {
      cwd: options.cwd,
      env: { ...cleanEnv, ORCA_USER_DATA_PATH: options.userDataDir },
      encoding: 'utf8',
      timeout: 30_000
    }
  )
  return JSON.parse(output) as unknown
}

export function seedCurrentClaudeTranscript(
  isolatedHome: string,
  providerSessionId: string,
  cwd: string
): string {
  const transcriptDir = path.join(isolatedHome, '.claude', 'projects', encodeClaudeProjectPath(cwd))
  mkdirSync(transcriptDir, { recursive: true })
  const transcriptPath = path.join(transcriptDir, `${providerSessionId}.jsonl`)
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: 'user',
      sessionId: providerSessionId,
      cwd,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: 'Report completion' }
    })}\n`
  )
  return transcriptPath
}

export function terminalIdentity(terminal: RuntimeTerminalSummary): TerminalIdentity {
  const { handle, incarnationId, leafId, ptyId, tabId, worktreeId } = terminal
  return { handle, incarnationId, leafId, ptyId, tabId, worktreeId }
}

export async function listRuntimeTerminals(
  client: RuntimeClient
): Promise<RuntimeTerminalSummary[]> {
  return (await client.call<RuntimeTerminalListResult>('terminal.list')).result.terminals
}

export function readPersistedWorkerRecoveryRecord(userDataDir: string, paneKey: string) {
  const dataPath = path.join(
    userDataDir,
    'profiles',
    DEFAULT_LOCAL_ORCA_PROFILE_ID,
    'orca-data.json'
  )
  if (!existsSync(dataPath)) {
    return null
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as {
    workspaceSession?: {
      sleepingAgentSessionsByPaneKey?: Record<
        string,
        {
          origin?: unknown
          state?: unknown
          providerSession?: { id?: unknown }
        }
      >
    }
  }
  return data.workspaceSession?.sleepingAgentSessionsByPaneKey?.[paneKey] ?? null
}
