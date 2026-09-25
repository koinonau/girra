import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

const userDataDir = mkdtempSync(join(tmpdir(), 'orca-pi-overlay-path-userdata-'))

import { PiTitlebarExtensionService } from './titlebar-extension-service'

const PATH_SHAPED_PTY_ID = [
  '50c010a2-bc8e-4eb1-8847-5812133ad6df',
  'Users',
  'dev',
  'orca',
  'workspaces',
  'noqa',
  'feature@@a1b2c3d4'
].join(sep)

function legacyOverlayPath(ptyId: string): string {
  return join(userDataDir, 'pi-agent-overlays', ptyId)
}

describe('PiTitlebarExtensionService legacy overlay paths', () => {
  beforeEach(() => {
    installFakeAppEnvironment({
      getPath: (name) => {
        if (name === 'userData') {
          return userDataDir
        }
        throw new Error(`unexpected app.getPath(${name})`)
      }
    })
  })

  afterEach(() => {
    rmSync(join(userDataDir, 'pi-agent-overlays'), { recursive: true, force: true })
  })

  it('does not redirect path-shaped PTY ids into active Pi homes', () => {
    const piHome = mkdtempSync(join(tmpdir(), 'orca-pi-overlay-path-home-'))
    const svc = new PiTitlebarExtensionService()

    try {
      const env = svc.buildPtyEnv(PATH_SHAPED_PTY_ID, piHome)

      expect(env.PI_CODING_AGENT_DIR).toBeUndefined()
      expect(env.GIRRA_PI_SOURCE_AGENT_DIR).toBe(piHome)
      expect(existsSync(join(userDataDir, 'pi-agent-overlays'))).toBe(false)
      expect(readdirSync(join(piHome, 'extensions')).sort()).toEqual([
        'orca-agent-status.ts',
        'orca-prefill.ts',
        'orca-titlebar-spinner.ts'
      ])
    } finally {
      rmSync(piHome, { recursive: true, force: true })
    }
  })

  it('clears legacy raw path-shaped daemon overlays during teardown', () => {
    const legacyOverlayDir = legacyOverlayPath(PATH_SHAPED_PTY_ID)
    mkdirSync(legacyOverlayDir, { recursive: true })
    writeFileSync(join(legacyOverlayDir, 'stale.txt'), 'stale overlay')

    const svc = new PiTitlebarExtensionService()
    svc.clearPty(PATH_SHAPED_PTY_ID)

    expect(existsSync(legacyOverlayDir)).toBe(false)
  })
})
