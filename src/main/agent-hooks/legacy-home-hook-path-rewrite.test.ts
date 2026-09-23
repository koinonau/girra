import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyGirraHomeDir } from '../../shared/girra-home-dir'
import { rewriteLegacyManagedHookPaths } from './legacy-home-hook-path-rewrite'

let home = ''

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'girra-hook-path-'))
  mkdirSync(join(home, '.claude'), { recursive: true })
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

function writeSettings(config: unknown): void {
  writeFileSync(join(home, '.claude', 'settings.json'), `${JSON.stringify(config, null, 2)}\n`)
}

function readSettings(): { hooks: Record<string, unknown[]>; model?: string } {
  return JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf-8'))
}

describe('rewriteLegacyManagedHookPaths', () => {
  it('repoints a hook command at the moved script', () => {
    const legacyScript = join(home, '.orca', 'agent-hooks', 'claude-hook.sh')
    writeSettings({
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `sh "${legacyScript}"` }] }] }
    })
    mkdirSync(join(home, '.orca', 'agent-hooks'), { recursive: true })
    expect(migrateLegacyGirraHomeDir(home)).toBe('moved')

    expect(rewriteLegacyManagedHookPaths(home)).toBe('rewritten')

    const command = (readSettings().hooks.SessionStart[0] as { hooks: { command: string }[] })
      .hooks[0].command
    expect(command).toBe(`sh "${join(home, '.girra', 'agent-hooks', 'claude-hook.sh')}"`)
  })

  it("leaves the user's own settings alone", () => {
    mkdirSync(join(home, '.orca'), { recursive: true })
    writeSettings({
      model: 'opus',
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: `sh "${join(home, '.orca', 'x.sh')}"` }] }
        ]
      }
    })
    migrateLegacyGirraHomeDir(home)

    rewriteLegacyManagedHookPaths(home)

    expect(readSettings().model).toBe('opus')
  })

  it('reports nothing to rewrite when no move happened', () => {
    writeSettings({ hooks: {} })
    expect(rewriteLegacyManagedHookPaths(home)).toBe('nothing-to-rewrite')
  })

  it('reports nothing to rewrite when the agent has no settings file', () => {
    rmSync(join(home, '.claude'), { recursive: true, force: true })
    mkdirSync(join(home, '.girra'), { recursive: true })
    expect(rewriteLegacyManagedHookPaths(home)).toBe('nothing-to-rewrite')
  })

  it('refuses to write a settings file it cannot parse', () => {
    mkdirSync(join(home, '.girra'), { recursive: true })
    const malformed = `{ "hooks": { "SessionStart": [ "${join(home, '.orca')}" `
    writeFileSync(join(home, '.claude', 'settings.json'), malformed)

    expect(rewriteLegacyManagedHookPaths(home)).toBe('failed')
    expect(readFileSync(join(home, '.claude', 'settings.json'), 'utf-8')).toBe(malformed)
  })
})
