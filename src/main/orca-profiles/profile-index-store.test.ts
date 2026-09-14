import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { removeTreeSync } from '../../shared/windows-transient-lock-removal'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createDefaultLocalOrcaProfile,
  DEFAULT_LOCAL_ORCA_PROFILE_ID,
  DEFAULT_LOCAL_ORCA_PROFILE_NAME,
  ORCA_PROFILE_INDEX_SCHEMA_VERSION,
  type OrcaProfileIndex
} from '../../shared/orca-profiles'

const testState = { dir: '' }

// Why the port and not vi.mock('electron'): profile path resolution reads AppEnvironment
// now, so an electron mock would be inert and every case would share the global fake's
// one temp dir instead of its own.
installFakeAppEnvironment({ getPath: () => testState.dir })

async function loadProfileIndexStore() {
  vi.resetModules()
  return import('./profile-index-store')
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('profile index store', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-profile-test-'))
    // Why re-install per test: the global setup's beforeEach reinstates its own fake.
    installFakeAppEnvironment({ getPath: () => testState.dir })
  })

  afterEach(() => {
    removeTreeSync(testState.dir)
  })

  it('creates the default local profile and copies legacy state without deleting it', async () => {
    const legacyState = { schemaVersion: 1, repos: [{ id: 'repo-1' }] }
    const legacyBackup = { schemaVersion: 1, repos: [{ id: 'backup-repo' }] }
    const legacyBrowserSessionMeta = {
      defaultSource: { browserFamily: 'chrome', importedAt: 1 },
      profiles: []
    }
    writeFileSync(join(testState.dir, 'orca-data.json'), JSON.stringify(legacyState), 'utf-8')
    writeFileSync(
      join(testState.dir, 'orca-data.json.bak.0'),
      JSON.stringify(legacyBackup),
      'utf-8'
    )
    writeFileSync(
      join(testState.dir, 'browser-session-meta.json'),
      JSON.stringify(legacyBrowserSessionMeta),
      'utf-8'
    )

    const { ensureActiveOrcaProfile, getOrcaProfileIndexPath } = await loadProfileIndexStore()
    const activeProfile = ensureActiveOrcaProfile()

    expect(activeProfile.profile.id).toBe(DEFAULT_LOCAL_ORCA_PROFILE_ID)
    expect(activeProfile.profile.name).toBe(DEFAULT_LOCAL_ORCA_PROFILE_NAME)
    expect(activeProfile.dataFile).toBe(
      join(testState.dir, 'profiles', DEFAULT_LOCAL_ORCA_PROFILE_ID, 'orca-data.json')
    )
    expect(readJson(activeProfile.dataFile)).toEqual(legacyState)
    expect(readJson(`${activeProfile.dataFile}.bak.0`)).toEqual(legacyBackup)
    expect(
      readJson(
        join(testState.dir, 'profiles', DEFAULT_LOCAL_ORCA_PROFILE_ID, 'browser-session-meta.json')
      )
    ).toEqual(legacyBrowserSessionMeta)
    expect(existsSync(join(testState.dir, 'orca-data.json'))).toBe(true)

    expect(readJson(getOrcaProfileIndexPath())).toMatchObject({
      schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
      activeProfileId: DEFAULT_LOCAL_ORCA_PROFILE_ID,
      profiles: [expect.objectContaining({ id: DEFAULT_LOCAL_ORCA_PROFILE_ID, kind: 'local' })]
    })
  })

  it('uses an existing active profile data file without overwriting it from legacy state', async () => {
    const profileId = 'work-profile'
    const profileDirectory = join(testState.dir, 'profiles', profileId)
    const profileData = { schemaVersion: 1, repos: [{ id: 'profile-repo' }] }
    mkdirSync(profileDirectory, { recursive: true })
    writeFileSync(join(profileDirectory, 'orca-data.json'), JSON.stringify(profileData), 'utf-8')
    writeFileSync(
      join(testState.dir, 'orca-data.json'),
      JSON.stringify({ schemaVersion: 1, repos: [{ id: 'legacy-repo' }] }),
      'utf-8'
    )
    const index: OrcaProfileIndex = {
      schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
      activeProfileId: profileId,
      profiles: [
        {
          id: profileId,
          name: 'Work',
          avatar: { kind: 'initials', initials: 'W', color: 'neutral' },
          kind: 'local',
          createdAt: 1,
          updatedAt: 1,
          lastOpenedAt: 1
        }
      ]
    }
    writeFileSync(join(testState.dir, 'orca-profile-index.json'), JSON.stringify(index), 'utf-8')

    const { ensureActiveOrcaProfile } = await loadProfileIndexStore()
    const activeProfile = ensureActiveOrcaProfile()

    expect(activeProfile.profile.id).toBe(profileId)
    expect(activeProfile.dataFile).toBe(join(profileDirectory, 'orca-data.json'))
    expect(readJson(activeProfile.dataFile)).toEqual(profileData)
  })

  const posixIt = process.platform === 'win32' ? it.skip : it
  posixIt('writes a fresh profile index when umask removes owner-write permission', async () => {
    const store = await loadProfileIndexStore()
    const indexPath = store.getOrcaProfileIndexPath()
    const profile = createDefaultLocalOrcaProfile(1)
    const index: OrcaProfileIndex = {
      schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
      activeProfileId: profile.id,
      profiles: [profile]
    }
    const originalUmask = process.umask(0o200)

    try {
      expect(() => store.writeProfileIndex(indexPath, index)).not.toThrow()
    } finally {
      process.umask(originalUmask)
    }

    expect(readJson(indexPath)).toEqual(index)
  })

  it('recovers a corrupted profile index from the backup copy', async () => {
    const store = await loadProfileIndexStore()
    const indexPath = store.getOrcaProfileIndexPath()
    const profile = createDefaultLocalOrcaProfile(1)
    const index: OrcaProfileIndex = {
      schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
      activeProfileId: profile.id,
      profiles: [profile, { ...profile, id: 'work', name: 'Work' }]
    }
    store.writeProfileIndex(indexPath, index)
    // Why a second write: only a write over a parseable index refreshes the backup.
    store.writeProfileIndex(indexPath, index)
    expect(existsSync(`${indexPath}.bak`)).toBe(true)
    writeFileSync(indexPath, '{ not json', 'utf-8')

    expect(store.readProfileIndex(indexPath)?.profiles.map((entry) => entry.id)).toEqual([
      profile.id,
      'work'
    ])
  })

  it('rejects profile ids that are not safe path segments', async () => {
    const store = await loadProfileIndexStore()
    const indexPath = store.getOrcaProfileIndexPath()
    const index: OrcaProfileIndex = {
      schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
      activeProfileId: '../../escape',
      profiles: [
        {
          id: '../../escape',
          name: 'Evil',
          avatar: { kind: 'initials', initials: 'E', color: 'neutral' },
          kind: 'local',
          createdAt: 1,
          updatedAt: 1,
          lastOpenedAt: 1
        }
      ]
    }
    mkdirSync(testState.dir, { recursive: true })
    writeFileSync(indexPath, JSON.stringify(index), 'utf-8')

    // The tampered entry is filtered; startup falls back to a fresh default.
    const state = store.ensureActiveOrcaProfile()
    expect(state.profile.id).toBe(DEFAULT_LOCAL_ORCA_PROFILE_ID)
  })
})
