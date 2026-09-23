import { describe, expect, it } from 'vitest'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AGENT_HOOK_SPOOL_MAX_FILES,
  drainAgentHookSpool,
  launchTokenHash,
  readSpoolRecords,
  type SpoolRecord
} from '../../shared/agent-hook-spool'
import { AgentHookServer, _internals } from './server'
import { buildBody } from './server.test-fixtures'
import { claudeHookService } from '../claude/hook-service'
import { createManagedHookLocalFilesystem } from './managed-hook-local-filesystem'
import { makePaneKey } from '../../shared/stable-pane-id'
import { buildPosixHookSpoolLines } from './hook-stdin-contract'

describe('agent hook spool', () => {
  it('appends each record with one printf write to prevent concurrent field interleaving', () => {
    const spoolLine = buildPosixHookSpoolLines('claude').find((line) =>
      line.includes('>> "$spool_file"')
    )
    expect(spoolLine).toBeDefined()
    expect(spoolLine!.match(/printf/g)).toHaveLength(1)
    expect(spoolLine).toContain('"$spool_now" "$payload"')
  })

  it('drops torn lines while retaining complete records', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-'))
    const file = join(dir, 'pane.jsonl')
    writeFileSync(
      file,
      '\n{"paneKey":"tab:1","source":"claude","receivedAt":1,"payload":{}}\n{"paneKey":'
    )
    expect(readSpoolRecords(file, 1)).toHaveLength(1)
  })

  it('waits for a newline before replaying a complete-looking final record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-unterminated-'))
    const spool = join(dir, 'spool')
    mkdirSync(spool)
    const file = join(spool, 'pane-live.jsonl')
    const record = JSON.stringify({
      paneKey: 'tab:live',
      source: 'claude',
      receivedAt: Date.now(),
      payload: { state: 'done' }
    })
    writeFileSync(file, record)
    const ingested: SpoolRecord[] = []
    const options = {
      endpointDir: dir,
      getPersistedLaunchTokenHash: () => undefined,
      ingest: (value: SpoolRecord) => ingested.push(value)
    }
    expect(readSpoolRecords(file)).toHaveLength(0)
    expect(drainAgentHookSpool(options)).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(record)

    appendFileSync(file, '\n')
    expect(drainAgentHookSpool(options)).toBe(1)
    expect(ingested).toHaveLength(1)
    expect(readFileSync(file)).toHaveLength(0)
  })

  it('does not let historical empty pane files starve newer records', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-empty-files-'))
    const spool = join(dir, 'spool')
    mkdirSync(spool)
    for (let index = 0; index < AGENT_HOOK_SPOOL_MAX_FILES; index += 1) {
      writeFileSync(join(spool, `pane-empty-${index}.jsonl`), '')
    }
    const live = join(spool, 'pane-live.jsonl')
    writeFileSync(
      live,
      `\n${JSON.stringify({ paneKey: 'tab:live', source: 'claude', receivedAt: Date.now(), payload: { state: 'done' } })}\n`
    )
    const ingested: SpoolRecord[] = []
    drainAgentHookSpool({
      endpointDir: dir,
      getPersistedLaunchTokenHash: () => undefined,
      ingest: (record) => ingested.push(record)
    })
    expect(ingested).toHaveLength(1)
    expect(ingested[0]?.paneKey).toBe('tab:live')
  })

  it('rejects stale launch tokens before ingest and truncates in place', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-'))
    const spool = join(dir, 'spool')
    mkdirSync(spool)
    const file = join(spool, 'pane-1.jsonl')
    writeFileSync(
      file,
      `\n${JSON.stringify({ paneKey: 'tab:1', source: 'claude', launchToken: 'old', receivedAt: Date.now(), payload: { state: 'done' } })}\n`
    )
    const inode = statSync(file).ino
    const ingested: unknown[] = []
    drainAgentHookSpool({
      endpointDir: dir,
      getPersistedLaunchTokenHash: () => launchTokenHash('new')!,
      ingest: (record) => ingested.push(record)
    })
    expect(ingested).toHaveLength(0)
    expect(readFileSync(file)).toHaveLength(0)
    expect(statSync(file).ino).toBe(inode)
  })

  it('ingests a record with the matching launch token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-'))
    const spool = join(dir, 'spool')
    mkdirSync(spool)
    const file = join(spool, 'pane-1.jsonl')
    writeFileSync(
      file,
      `\n${JSON.stringify({ paneKey: 'tab:1', source: 'claude', launchToken: 'same', receivedAt: Date.now(), payload: { state: 'done' } })}\n`
    )
    const ingested: unknown[] = []
    drainAgentHookSpool({
      endpointDir: dir,
      getPersistedLaunchTokenHash: () => launchTokenHash('same')!,
      ingest: (record) => ingested.push(record)
    })
    expect(ingested).toHaveLength(1)
    expect(ingested[0]).toMatchObject({ paneKey: 'tab:1', isReplay: true })
  })

  it('replays a spooled Claude SubagentStop through the server after restart', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-spool-e2e-'))
    const paneKey = makePaneKey('tab-spool', '00000000-0000-4000-8000-000000000001')
    const launchToken = 'generation-token'
    const first = new AgentHookServer()
    await first.start({ env: 'production', userDataPath })
    const started = _internals.normalizeHookPayload(
      'claude',
      buildBody({ hook_event_name: 'SubagentStart', agent_id: 'child-spooled' }),
      'production'
    )!
    first.ingestRemote(
      {
        paneKey,
        source: 'claude',
        hookEventName: 'SubagentStart',
        launchToken,
        payload: started.payload
      },
      'spool-test'
    )
    expect(first.getStatusSnapshot()).toHaveLength(1)
    expect(first.getStatusSnapshot()[0]!.subagents).toHaveLength(1)
    first.flushStatusPersistSync()
    first.stop()
    const spoolDir = join(userDataPath, 'agent-hooks', 'spool')
    mkdirSync(spoolDir, { recursive: true })
    writeFileSync(
      join(spoolDir, 'pane-tab-spooled_0.jsonl'),
      `\n${JSON.stringify({ paneKey, source: 'claude', hookEventName: 'SubagentStop', launchToken, receivedAt: Date.now(), payload: { hook_event_name: 'SubagentStop', agent_id: 'child-spooled' } })}\n`
    )
    const restarted = new AgentHookServer()
    await restarted.start({ env: 'production', userDataPath })
    try {
      const snapshot = restarted.getStatusSnapshot()
      expect(snapshot).toHaveLength(1)
      expect(snapshot[0]!.subagents).toBeUndefined()
      restarted.flushStatusPersistSync()
      expect(readFileSync(restarted.lastStatusPath!, 'utf8')).not.toContain('isReplay')
    } finally {
      restarted.stop()
    }
  })

  it('rejects a stale remote replay against the hydrated launch-token fence', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-spool-remote-fence-'))
    const paneKey = makePaneKey('tab-remote-fence', '00000000-0000-4000-8000-000000000003')
    const first = new AgentHookServer()
    const second = new AgentHookServer()
    try {
      await first.start({ env: 'production', userDataPath })
      first.ingestRemote(
        {
          paneKey,
          source: 'claude',
          launchToken: 'old-generation',
          payload: { state: 'working', agentType: 'claude', prompt: 'old' }
        },
        'ssh-1'
      )
      first.flushStatusPersistSync()
      first.stop()

      await second.start({ env: 'production', userDataPath })
      second.ingestRemote(
        {
          paneKey,
          source: 'claude',
          launchToken: 'new-generation',
          isReplay: true,
          payload: { state: 'done', agentType: 'claude', prompt: 'stale completion' }
        },
        'ssh-2'
      )
      expect(second.getStatusSnapshot()[0]).toMatchObject({
        paneKey,
        state: 'working',
        prompt: 'old'
      })
    } finally {
      first.stop()
      second.stop()
    }
  })

  it('spools when the endpoint is present but the receiver is unavailable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-spool-failure-'))
    const endpointDir = join(dir, 'agent-hooks')
    mkdirSync(endpointDir, { recursive: true })
    const endpoint = join(endpointDir, 'endpoint.env')
    writeFileSync(
      endpoint,
      'GIRRA_AGENT_HOOK_PORT=9\nGIRRA_AGENT_HOOK_TOKEN=stale\nGIRRA_AGENT_HOOK_ENV=production\nGIRRA_AGENT_HOOK_VERSION=1\n'
    )
    await claudeHookService.installRemote(createManagedHookLocalFilesystem(), dir)
    const scriptDir = join(dir, '.orca', 'agent-hooks')
    const script = join(
      scriptDir,
      readdirSync(scriptDir).find((name) => name.endsWith('.sh'))!
    )
    execFileSync('/bin/sh', [script], {
      input: '{"hook_event_name":"SubagentStop","agent_id":"child"}\n',
      env: {
        ...process.env,
        GIRRA_AGENT_HOOK_ENDPOINT: endpoint,
        CLAUDE_JOB_DIR: '',
        DEVIN_PROJECT_DIR: '',
        GIRRA_PANE_KEY: 'tab-failure:0',
        GIRRA_TAB_ID: 'tab-failure',
        GIRRA_AGENT_LAUNCH_TOKEN: 'generation-token'
      },
      timeout: 5000
    })
    const spoolFiles = readdirSync(join(endpointDir, 'spool'))
    expect(spoolFiles).toHaveLength(1)
    expect(readFileSync(join(endpointDir, 'spool', spoolFiles[0]!), 'utf8')).toContain(
      'SubagentStop'
    )
  })

  it('does not mark a non-terminal downtime replay as runtime-observed', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-spool-observed-'))
    const paneKey = makePaneKey('tab-observed', '00000000-0000-4000-8000-000000000002')
    const launchToken = 'observed-generation'
    const first = new AgentHookServer()
    await first.start({ env: 'production', userDataPath })
    const started = _internals.normalizeHookPayload(
      'claude',
      buildBody({ hook_event_name: 'SubagentStart', agent_id: 'child-observed' }),
      'production'
    )!
    first.ingestRemote(
      {
        paneKey,
        source: 'claude',
        hookEventName: 'SubagentStart',
        launchToken,
        payload: started.payload
      },
      null
    )
    first.flushStatusPersistSync()
    first.stop()
    const spoolDir = join(userDataPath, 'agent-hooks', 'spool')
    mkdirSync(spoolDir, { recursive: true })
    writeFileSync(
      join(spoolDir, 'pane-observed.jsonl'),
      `\n${JSON.stringify({ paneKey, source: 'claude', hookEventName: 'SubagentStart', launchToken, receivedAt: Date.now(), payload: started.payload })}\n`
    )
    const restarted = new AgentHookServer()
    await restarted.start({ env: 'production', userDataPath })
    try {
      expect(restarted.getStatusChangeSnapshot()[0]?.observedInCurrentRuntime).toBe(false)
    } finally {
      restarted.stop()
    }
  })
})
