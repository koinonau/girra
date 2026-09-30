import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { safeStorage } from 'electron'
import { runProcessSync } from '../../shared/child-process/run-process'

/**
 * Reads secrets this app sealed before it was renamed from Orca to Girra.
 *
 * Electron names the macOS keychain item after `app.getName()`, so each rename left every
 * safeStorage blob unreadable by the new key: Orca's `Orca`, then Girra 1.0.0's `orca`, which
 * shipped no `productName` and so fell through to package.json's `name`.
 *
 * The old items are still there, and their passwords still derive the old keys, so a failed
 * decrypt falls through to here rather than losing the secret. Chromium's scheme:
 * PBKDF2-HMAC-SHA1 over the keychain password, then AES-128-CBC behind a `v10` prefix.
 */
const PBKDF2_SALT = 'saltysalt'
const PBKDF2_ITERATIONS = 1003
const PBKDF2_KEY_LENGTH = 16
const AES_IV = Buffer.alloc(16, ' ')
const VERSION_PREFIX = 'v10'

// Each legacy app name yields two accounts; newer Chromium writes the "<name> Key" one.
const LEGACY_APP_NAMES = ['Orca', 'Orca Dev', 'orca', 'orca-dev'] as const

let cachedKeys: Buffer[] | undefined

function readKeychainPassword(service: string, account: string): string | null {
  const result = runProcessSync({
    program: 'security',
    args: ['find-generic-password', '-s', service, '-a', account, '-w'],
    timeoutMs: 30_000
  })
  if (result.code !== 0 || result.timedOut) {
    return null
  }
  const raw = result.stdout.trim()
  return raw.length > 0 ? raw : null
}

/**
 * Every legacy key present on this host, in name order.
 *
 * Why all of them and not the first hit: a user who ran upstream Orca as well as Girra has
 * both `Orca Safe Storage` and `orca Safe Storage`, and only one of them sealed this blob.
 * Stopping at the first would fail the decrypt and report the secret as unreadable.
 */
function resolveLegacyKeys(): Buffer[] {
  if (cachedKeys !== undefined) {
    return cachedKeys
  }
  cachedKeys = []
  if (process.platform !== 'darwin') {
    return cachedKeys
  }
  for (const name of LEGACY_APP_NAMES) {
    for (const account of [name, `${name} Key`]) {
      const password = readKeychainPassword(`${name} Safe Storage`, account)
      if (password) {
        cachedKeys.push(
          pbkdf2Sync(password, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, 'sha1')
        )
      }
    }
  }
  return cachedKeys
}

/** The plaintext this app sealed under its pre-rename name, or null when it cannot be read. */
export function decryptWithLegacyOrcaKey(cipher: Buffer): string | null {
  if (cipher.subarray(0, VERSION_PREFIX.length).toString('utf8') !== VERSION_PREFIX) {
    return null
  }
  for (const key of resolveLegacyKeys()) {
    try {
      const decipher = createDecipheriv('aes-128-cbc', key, AES_IV)
      const plain = Buffer.concat([
        decipher.update(cipher.subarray(VERSION_PREFIX.length)),
        decipher.final()
      ])
      return plain.toString('utf8')
    } catch {
      // Why: CBC cannot authenticate, so a wrong key surfaces as a padding error, not a wrong string.
    }
  }
  return null
}

/** Unseals with this app's key, falling back to the pre-rename one. Throws the original error. */
export function decryptSealedSecret(cipher: Buffer): string {
  try {
    return safeStorage.decryptString(cipher)
  } catch (error) {
    const legacy = decryptWithLegacyOrcaKey(cipher)
    if (legacy === null) {
      throw error
    }
    return legacy
  }
}

/** Test seam: forget the resolved keys so the next read probes the keychain again. */
export function resetLegacyOrcaKeyCache(): void {
  cachedKeys = undefined
}
