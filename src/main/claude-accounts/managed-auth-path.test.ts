import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

// Mutable userData the AppEnvironment port resolves, flipped mid-test to stand in for the
// app.setName rename moving app.getPath('userData') on a case-sensitive filesystem.
const appState = { userData: '' }

installFakeAppEnvironment({ getPath: () => appState.userData })

describe('managed Claude accounts root', () => {
  let root: string
  let canonicalDir: string
  let lateDir: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-managed-auth-path-'))
    canonicalDir = join(root, 'userdata-early')
    lateDir = join(root, 'userdata-late')
    mkdirSync(canonicalDir, { recursive: true })
    mkdirSync(lateDir, { recursive: true })
    // Why re-install: the global setup's beforeEach reinstates its own fake.
    installFakeAppEnvironment({ getPath: () => appState.userData })
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.resetModules()
  })

  it('stays on the path captured before app.setName changes resolution', async () => {
    appState.userData = canonicalDir
    const { initDataPath } = await import('../persistence')
    initDataPath()

    appState.userData = lateDir

    const { getClaudeManagedAccountsRoot } = await import('./managed-auth-path')
    expect(getClaudeManagedAccountsRoot()).toBe(join(canonicalDir, 'claude-accounts'))
    expect(getClaudeManagedAccountsRoot()).not.toBe(join(lateDir, 'claude-accounts'))
  })
})
