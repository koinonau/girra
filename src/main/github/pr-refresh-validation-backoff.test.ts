import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPRRefreshValidationBackoffForTests,
  getPRRefreshValidationBackoffCountForTests,
  notePRRefreshValidationDenial
} from './pr-refresh-validation-backoff'

describe('PR refresh validation backoff', () => {
  beforeEach(() => {
    clearPRRefreshValidationBackoffForTests()
  })

  it('backs off repeated automatic validation denials until the TTL expires', () => {
    const identity = {
      repoId: 'repo-1',
      repoPath: '/workspace/missing',
      reason: 'unknown-repo' as const
    }

    expect(notePRRefreshValidationDenial(identity, 0)).toBe('validation-denied')
    expect(notePRRefreshValidationDenial(identity, 60_000)).toBe('validation-backoff')
    expect(notePRRefreshValidationDenial(identity, 5 * 60_000 + 1)).toBe('validation-denied')
  })

  it('bounds validation backoff entries', () => {
    for (let index = 0; index < 257; index += 1) {
      notePRRefreshValidationDenial(
        {
          repoId: `repo-${index}`,
          repoPath: `/workspace/missing-${index}`,
          reason: 'unknown-repo'
        },
        index
      )
    }

    expect(getPRRefreshValidationBackoffCountForTests()).toBe(256)
  })
})
