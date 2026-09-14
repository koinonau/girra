import { resolve } from 'node:path'

const VALIDATION_BACKOFF_TTL_MS = 5 * 60_000
const MAX_VALIDATION_BACKOFF_ENTRIES = 256

export type PRRefreshValidationDenialReason =
  | 'unknown-repo'
  | 'repo-path-mismatch'
  | 'host-mismatch'

type ValidationBackoffIdentity = {
  repoId?: string | null
  repoPath: string
  reason: PRRefreshValidationDenialReason
}

type ValidationBackoffEntry = {
  expiresAt: number
}

const validationBackoff = new Map<string, ValidationBackoffEntry>()

function validationIdentityKey(identity: ValidationBackoffIdentity): string {
  return [identity.repoId ?? '', resolve(identity.repoPath), identity.reason].join('\0')
}

function evictOldestValidationBackoffEntries(): void {
  while (validationBackoff.size > MAX_VALIDATION_BACKOFF_ENTRIES) {
    const oldest = validationBackoff.keys().next()
    if (oldest.done) {
      break
    }
    validationBackoff.delete(oldest.value)
  }
}

export function notePRRefreshValidationDenial(
  identity: ValidationBackoffIdentity,
  nowMs = Date.now()
): 'validation-denied' | 'validation-backoff' {
  const key = validationIdentityKey(identity)
  const existing = validationBackoff.get(key)
  if (existing && existing.expiresAt > nowMs) {
    return 'validation-backoff'
  }
  if (existing) {
    validationBackoff.delete(key)
  }
  validationBackoff.set(key, { expiresAt: nowMs + VALIDATION_BACKOFF_TTL_MS })
  evictOldestValidationBackoffEntries()
  return 'validation-denied'
}

export function clearPRRefreshValidationBackoffForTests(): void {
  validationBackoff.clear()
}

export function getPRRefreshValidationBackoffCountForTests(): number {
  return validationBackoff.size
}
