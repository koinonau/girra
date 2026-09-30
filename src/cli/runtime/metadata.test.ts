import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultUserDataPath } from './metadata'

const HOME = join('/home', 'someone')

beforeEach(() => {
  // Why unset: the env var short-circuits every platform branch below.
  vi.stubEnv('GIRRA_USER_DATA_PATH', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// Why this matters: the CLI is its own process and resolves the profile directory itself, so it
// has to land on the same name Electron derives from productName.
describe('getDefaultUserDataPath', () => {
  it('names the Girra profile on macOS', () => {
    expect(getDefaultUserDataPath('darwin', HOME)).toBe(
      join(HOME, 'Library', 'Application Support', 'Girra')
    )
  })

  it('names the Girra profile under APPDATA on Windows', () => {
    vi.stubEnv('APPDATA', join('C:', 'Users', 'someone', 'AppData', 'Roaming'))
    expect(getDefaultUserDataPath('win32', HOME)).toBe(
      join('C:', 'Users', 'someone', 'AppData', 'Roaming', 'Girra')
    )
  })

  it('refuses rather than guessing when Windows has no APPDATA', () => {
    vi.stubEnv('APPDATA', '')
    expect(() => getDefaultUserDataPath('win32', HOME)).toThrow(/APPDATA is not set/)
  })

  it('honours XDG_CONFIG_HOME on Linux, else ~/.config', () => {
    vi.stubEnv('XDG_CONFIG_HOME', join('/xdg', 'config'))
    expect(getDefaultUserDataPath('linux', HOME)).toBe(join('/xdg', 'config', 'Girra'))

    vi.stubEnv('XDG_CONFIG_HOME', '')
    expect(getDefaultUserDataPath('linux', HOME)).toBe(join(HOME, '.config', 'Girra'))
  })

  // Why: a 1.0.0 profile is left in place for Orca, so the CLI must never resolve to it.
  it('never names the pre-rename orca profile', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      expect(getDefaultUserDataPath(platform, homedir())).not.toMatch(/[/\\]orca$/)
    }
  })

  it('prefers GIRRA_USER_DATA_PATH, which targets a dev or parallel instance', () => {
    vi.stubEnv('GIRRA_USER_DATA_PATH', join(HOME, 'orca-dev'))
    expect(getDefaultUserDataPath('darwin', HOME)).toBe(join(HOME, 'orca-dev'))
  })
})
