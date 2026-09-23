import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeHookService } from '../claude/hook-service'
import { createManagedHookLocalFilesystem } from './managed-hook-local-filesystem'

let managedScript = ''
// Why: Claude-compatible permission hooks fail closed on empty stdout, so the neutral JSON is the silent output.
const NEUTRAL_STDOUT = '{}\n'

beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'orca-outside-home-'))
  await claudeHookService.installRemote(createManagedHookLocalFilesystem(), home)
  managedScript = readFileSync(join(home, '.orca', 'agent-hooks', 'claude-hook.sh'), 'utf8')
})

/** Managed hooks are installed into the user's agent config, so they also run when the
 *  agent is launched from a plain terminal. There they must be inert and silent. */
function runHook(dir: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const script = join(dir, 'claude-hook.sh')
  writeFileSync(script, managedScript)
  chmodSync(script, 0o755)
  const clean: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('GIRRA_') && !k.startsWith('ORCA_')) {
      clean[k] = v
    }
  }
  return spawnSync('/bin/sh', [script], {
    input: '{"hook_event_name":"SubagentStop","agent_id":"child"}\n',
    env: { ...clean, ...extraEnv },
    timeout: 5000,
    encoding: 'utf8'
  })
}

describe('managed hook outside a Girra terminal', () => {
  it('no Girra env at all: silent, exit 0, writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-outside-'))
    const res = runHook(dir)
    expect(res.status).toBe(0)
    expect(res.stdout).toBe(NEUTRAL_STDOUT)
    expect(res.stderr).toBe('')
    expect(readdirSync(dir)).toEqual(['claude-hook.sh'])
  })

  it('pane key present but no endpoint: still silent and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-outside-partial-'))
    const res = runHook(dir, { GIRRA_PANE_KEY: 'tab:0', GIRRA_TAB_ID: 'tab' })
    expect(res.status).toBe(0)
    expect(res.stdout).toBe(NEUTRAL_STDOUT)
    expect(res.stderr).toBe('')
    expect(readdirSync(dir)).toEqual(['claude-hook.sh'])
  })

  it('endpoint points at a path that does not exist: silent, exit 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-outside-stale-'))
    const res = runHook(dir, {
      GIRRA_AGENT_HOOK_ENDPOINT: join(dir, 'gone', 'deeper', 'endpoint.env'),
      GIRRA_PANE_KEY: 'tab:0'
    })
    expect(res.status).toBe(0)
    expect(res.stdout).toBe(NEUTRAL_STDOUT)
    expect(res.stderr).toBe('')
    // a stale env var must not create a spool tree for a Girra that is not installed here
    expect(readdirSync(dir)).toEqual(['claude-hook.sh'])
  })

  it('readable endpoint without a pane key: silent, writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-outside-readable-'))
    const endpoint = join(dir, 'endpoint.env')
    writeFileSync(endpoint, 'GIRRA_AGENT_HOOK_PORT=9\nGIRRA_AGENT_HOOK_TOKEN=stale\n')
    const res = runHook(dir, { GIRRA_AGENT_HOOK_ENDPOINT: endpoint })
    expect(res.status).toBe(0)
    expect(res.stdout).toBe(NEUTRAL_STDOUT)
    expect(res.stderr).toBe('')
    expect(readdirSync(dir).sort()).toEqual(['claude-hook.sh', 'endpoint.env'])
  })
})
