import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getGirraHomeDir,
  getLegacyGirraHomeDir,
  migrateLegacyGirraHomeDir
} from './girra-home-dir'

let home = ''

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'girra-home-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('getGirraHomeDir', () => {
  it('reads the legacy tree while it is the only one present', () => {
    mkdirSync(join(home, '.orca'))
    expect(getGirraHomeDir(home)).toBe(join(home, '.orca'))
  })

  it('prefers the current tree once it exists', () => {
    mkdirSync(join(home, '.orca'))
    mkdirSync(join(home, '.girra'))
    expect(getGirraHomeDir(home)).toBe(join(home, '.girra'))
  })

  it('names the current tree when neither exists, so a first write creates it', () => {
    expect(getGirraHomeDir(home)).toBe(join(home, '.girra'))
    expect(getLegacyGirraHomeDir(home)).toBe(join(home, '.orca'))
  })
})

describe('migrateLegacyGirraHomeDir', () => {
  it('moves the tree and its contents', () => {
    mkdirSync(join(home, '.orca', 'agent-hooks'), { recursive: true })
    writeFileSync(join(home, '.orca', 'agent-hooks', 'claude-hook.sh'), '#!/bin/sh\n')

    expect(migrateLegacyGirraHomeDir(home)).toBe('moved')
    expect(readFileSync(join(home, '.girra', 'agent-hooks', 'claude-hook.sh'), 'utf8')).toBe(
      '#!/bin/sh\n'
    )
    expect(existsSync(join(home, '.orca'))).toBe(false)
  })

  it('is a no-op on the second run', () => {
    mkdirSync(join(home, '.orca'))
    expect(migrateLegacyGirraHomeDir(home)).toBe('moved')
    expect(migrateLegacyGirraHomeDir(home)).toBe('already-migrated')
  })

  it('reports nothing to move on a first install', () => {
    expect(migrateLegacyGirraHomeDir(home)).toBe('nothing-to-move')
  })

  // Why: an older build recreates ~/.orca after a migration, and merging the two
  // without knowing which is current loses whichever gets overwritten.
  it('refuses when both trees exist rather than merging them', () => {
    mkdirSync(join(home, '.orca'))
    mkdirSync(join(home, '.girra'))
    expect(migrateLegacyGirraHomeDir(home)).toBe('failed')
    expect(existsSync(join(home, '.orca'))).toBe(true)
  })
})
