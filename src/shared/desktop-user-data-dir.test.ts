import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { USER_DATA_DIR_NAME } from './desktop-user-data-dir'

// Why a test and not a comment: Electron derives userData from package.json's productName, so a
// change there that misses this constant leaves the CLI and the logs fallback naming a directory
// the app never writes. That fails as "no runtime found", far from the edit that caused it.
describe('USER_DATA_DIR_NAME', () => {
  it('matches the productName Electron resolves userData from', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as { productName?: string }
    expect(manifest.productName).toBe(USER_DATA_DIR_NAME)
  })

  // Why the source text and not a require: the config runs packaging side effects on import.
  it('matches the productName electron-builder gives the bundle', () => {
    const config = readFileSync('config/electron-builder.config.cjs', 'utf8')
    expect(config).toContain(`productName: '${USER_DATA_DIR_NAME}'`)
  })
})
