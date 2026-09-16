import { createCipheriv, pbkdf2Sync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runProcessSync = vi.hoisted(() => vi.fn())
const decryptString = vi.hoisted(() => vi.fn())

vi.mock('../../shared/child-process/run-process', () => ({ runProcessSync }))
vi.mock('electron', () => ({ safeStorage: { decryptString } }))

import {
  decryptSealedSecret,
  decryptWithLegacyOrcaKey,
  resetLegacyOrcaKeyCache
} from './legacy-orca-safe-storage'

const KEYCHAIN_PASSWORD = 'bG9uZy1yYW5kb20tcGFzc3dvcmQ='

function sealWithLegacyKey(plainText: string): Buffer {
  const key = pbkdf2Sync(KEYCHAIN_PASSWORD, 'saltysalt', 1003, 16, 'sha1')
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '))
  return Buffer.concat([Buffer.from('v10'), cipher.update(plainText, 'utf8'), cipher.final()])
}

function keychainHit(service: string): void {
  runProcessSync.mockImplementation(({ args }: { args: readonly string[] }) =>
    args.includes(service)
      ? { code: 0, stdout: `${KEYCHAIN_PASSWORD}\n`, stderr: '', timedOut: false }
      : { code: 44, stdout: '', stderr: 'not found', timedOut: false }
  )
}

describe('legacy Orca safe storage', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    resetLegacyOrcaKeyCache()
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    vi.clearAllMocks()
  })

  it('reads a secret sealed under the pre-rename app name', () => {
    keychainHit('Orca Safe Storage')
    expect(decryptWithLegacyOrcaKey(sealWithLegacyKey('sk-live-42'))).toBe('sk-live-42')
  })

  it('reads a dev profile secret, whose keychain item carries the Dev suffix', () => {
    keychainHit('Orca Dev Safe Storage')
    expect(decryptWithLegacyOrcaKey(sealWithLegacyKey('dev-token'))).toBe('dev-token')
  })

  it('returns null when no legacy keychain item answers', () => {
    runProcessSync.mockReturnValue({ code: 44, stdout: '', stderr: '', timedOut: false })
    expect(decryptWithLegacyOrcaKey(sealWithLegacyKey('sk-live-42'))).toBeNull()
  })

  it('leaves non-darwin hosts alone, where the key never moved', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    expect(decryptWithLegacyOrcaKey(sealWithLegacyKey('sk-live-42'))).toBeNull()
    expect(runProcessSync).not.toHaveBeenCalled()
  })

  it('prefers this app key and only falls back when it throws', () => {
    decryptString.mockReturnValue('current-key-value')
    expect(decryptSealedSecret(Buffer.from('v10ciphertext'))).toBe('current-key-value')
    expect(runProcessSync).not.toHaveBeenCalled()
  })

  it('rethrows the original failure when the legacy key cannot read it either', () => {
    decryptString.mockImplementation(() => {
      throw new Error('decrypt failed')
    })
    runProcessSync.mockReturnValue({ code: 44, stdout: '', stderr: '', timedOut: false })
    expect(() => decryptSealedSecret(sealWithLegacyKey('sk-live-42'))).toThrow('decrypt failed')
  })

  it('falls back to the legacy key when this app key throws', () => {
    decryptString.mockImplementation(() => {
      throw new Error('decrypt failed')
    })
    keychainHit('Orca Safe Storage')
    expect(decryptSealedSecret(sealWithLegacyKey('sk-live-42'))).toBe('sk-live-42')
  })
})
