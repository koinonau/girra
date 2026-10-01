import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGirraHomeDir, getGirraHomeDirWithLegacyFallback } from './girra-home-dir'

let home = ''

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'girra-home-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('getGirraHomeDir', () => {
  it('names its own tree when neither exists, so a first write creates it', () => {
    expect(getGirraHomeDir(home)).toBe(join(home, '.girra'))
  })

  // Why: upstream Orca stays installed and running, and owns ~/.orca (ADR-0004).
  it('names its own tree while only the Orca one is present', () => {
    mkdirSync(join(home, '.orca'))
    expect(getGirraHomeDir(home)).toBe(join(home, '.girra'))
  })

  it('leaves the Orca tree and its contents untouched on a first launch', () => {
    mkdirSync(join(home, '.orca', 'agent-hooks'), { recursive: true })
    const orcaScript = join(home, '.orca', 'agent-hooks', 'claude-hook.sh')
    writeFileSync(orcaScript, '#!/bin/sh\n')

    // Resolving, then writing under the resolved tree, is the whole startup path now
    // that no migration runs.
    mkdirSync(getGirraHomeDir(home), { recursive: true })

    expect(existsSync(join(home, '.orca'))).toBe(true)
    expect(readFileSync(orcaScript, 'utf8')).toBe('#!/bin/sh\n')
  })
})

describe('getGirraHomeDirWithLegacyFallback', () => {
  // Why this reader exists: the relay and a headless orcad run no migration, so state
  // predating the rename is only reachable through the legacy tree.
  it('reads the legacy tree while it is the only one present', () => {
    mkdirSync(join(home, '.orca'))
    expect(getGirraHomeDirWithLegacyFallback(home)).toBe(join(home, '.orca'))
  })

  it('prefers the current tree once it exists', () => {
    mkdirSync(join(home, '.orca'))
    mkdirSync(join(home, '.girra'))
    expect(getGirraHomeDirWithLegacyFallback(home)).toBe(join(home, '.girra'))
  })

  it('names the current tree when neither exists', () => {
    expect(getGirraHomeDirWithLegacyFallback(home)).toBe(join(home, '.girra'))
  })
})
