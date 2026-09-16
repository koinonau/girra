import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { appRelaunchMock } = vi.hoisted(() => ({
  appRelaunchMock: vi.fn()
}))

vi.mock('electron', () => ({ app: { relaunch: appRelaunchMock } }))

import { relaunchApp } from './app-relaunch'
import { _resetHydrateShellPathCache, _setLaunchPathForTests } from './startup/hydrate-shell-path'

beforeEach(() => {
  appRelaunchMock.mockReset()
})

const originalPath = process.env.PATH

afterEach(() => {
  _resetHydrateShellPathCache()
  if (originalPath === undefined) {
    delete process.env.PATH
  } else {
    process.env.PATH = originalPath
  }
})

describe('relaunchApp', () => {
  it('does not carry Girra PATH seeds into the replacement process', () => {
    process.env.PATH = '/seeded/newest-nvm/bin:/usr/bin'
    _setLaunchPathForTests('/usr/bin')
    let inheritedPath: string | undefined
    appRelaunchMock.mockImplementation(() => {
      inheritedPath = process.env.PATH
    })

    relaunchApp('renderer-request')

    expect(inheritedPath).toBe('/usr/bin')
    expect(process.env.PATH).toBe('/seeded/newest-nvm/bin:/usr/bin')
  })
})
