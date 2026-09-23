import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { bestEffortFsyncDirectorySync, fsyncFileSync } from '../../shared/secure-file'
import {
  createDefaultLocalOrcaProfile,
  DEFAULT_LOCAL_GIRRA_PROFILE_ID,
  GIRRA_PROFILE_INDEX_SCHEMA_VERSION,
  type OrcaProfileIndex,
  type OrcaProfileSummary
} from '../../shared/orca-profiles'
import {
  getOrcaProfileBrowserSessionMetaFile,
  getOrcaProfileDataFile,
  getOrcaProfileDirectory,
  getOrcaProfileIndexPath,
  getProfileUserDataPath,
  LEGACY_BACKUP_COUNT,
  legacyBackupPath,
  legacyBrowserSessionMetaPath,
  legacyDataFilePath,
  profileBackupPath
} from './profile-storage-paths'

export { getOrcaProfileIndexPath, initOrcaProfilePaths } from './profile-storage-paths'

export type ActiveOrcaProfileState = {
  index: OrcaProfileIndex
  profile: OrcaProfileSummary
  dataFile: string
  profileDirectory: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProfileSummary(value: unknown): value is OrcaProfileSummary {
  if (!isObject(value)) {
    return false
  }
  const avatar = value.avatar
  const cloud = value.cloud
  return (
    typeof value.id === 'string' &&
    // Why: IDs from the on-disk index become filesystem path segments; a
    // tampered index must not be able to escape the profiles directory.
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.id) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    (value.kind === 'local' || value.kind === 'cloud-linked') &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    typeof value.lastOpenedAt === 'number' &&
    isObject(avatar) &&
    avatar.kind === 'initials' &&
    typeof avatar.initials === 'string' &&
    avatar.color === 'neutral' &&
    (cloud === undefined || isObject(cloud))
  )
}

function normalizeProfileIndex(raw: unknown): OrcaProfileIndex | null {
  if (!isObject(raw) || !Array.isArray(raw.profiles)) {
    return null
  }
  const profiles = raw.profiles.filter(isProfileSummary)
  const activeProfileId =
    typeof raw.activeProfileId === 'string' &&
    profiles.some((profile) => profile.id === raw.activeProfileId)
      ? raw.activeProfileId
      : profiles[0]?.id
  if (!activeProfileId) {
    return null
  }
  return {
    schemaVersion: GIRRA_PROFILE_INDEX_SCHEMA_VERSION,
    activeProfileId,
    profiles
  }
}

function readProfileIndexFile(indexPath: string): OrcaProfileIndex | null {
  try {
    return normalizeProfileIndex(JSON.parse(readFileSync(indexPath, 'utf-8')))
  } catch {
    return null
  }
}

export function readProfileIndex(indexPath: string): OrcaProfileIndex | null {
  // Why: a torn/corrupt index must not silently reset the app to a single
  // default profile — that would orphan every other profile's data directory.
  return readProfileIndexFile(indexPath) ?? readProfileIndexFile(`${indexPath}.bak`)
}

export function writeProfileIndex(indexPath: string, index: OrcaProfileIndex): void {
  mkdirSync(dirname(indexPath), { recursive: true })
  // Why: only a still-parseable current index may refresh the backup;
  // copying a corrupt file over the backup would destroy the recovery copy.
  if (existsSync(indexPath) && readProfileIndexFile(indexPath)) {
    try {
      copyFileSync(indexPath, `${indexPath}.bak`)
    } catch {
      // Best-effort backup; the primary write below still proceeds.
    }
  }
  const tmpPath = `${indexPath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(index, null, 2), 'utf-8')
  fsyncFileSync(tmpPath)
  renameSync(tmpPath, indexPath)
  bestEffortFsyncDirectorySync(dirname(indexPath))
}

function copyIfPresent(source: string, target: string): void {
  if (!existsSync(source) || existsSync(target)) {
    return
  }
  mkdirSync(dirname(target), { recursive: true })
  // Why: tmp+rename so a crash mid-copy cannot leave a truncated target that
  // the exists() guard above would then treat as a completed migration.
  const tmpTarget = `${target}.tmp`
  copyFileSync(source, tmpTarget)
  renameSync(tmpTarget, target)
}

function copyLegacyStateToProfile(userDataPath: string, profileId: string): void {
  const profileDataFile = getOrcaProfileDataFile(profileId, userDataPath)
  copyIfPresent(legacyDataFilePath(userDataPath), profileDataFile)
  copyIfPresent(
    legacyBrowserSessionMetaPath(userDataPath),
    getOrcaProfileBrowserSessionMetaFile(profileId, userDataPath)
  )
  for (let i = 0; i < LEGACY_BACKUP_COUNT; i++) {
    copyIfPresent(legacyBackupPath(userDataPath, i), profileBackupPath(profileDataFile, i))
  }
}

function createInitialProfileIndex(now = Date.now()): OrcaProfileIndex {
  const profile = createDefaultLocalOrcaProfile(now)
  return {
    schemaVersion: GIRRA_PROFILE_INDEX_SCHEMA_VERSION,
    activeProfileId: profile.id,
    profiles: [profile]
  }
}

function getActiveProfile(index: OrcaProfileIndex): OrcaProfileSummary {
  return (
    index.profiles.find((profile) => profile.id === index.activeProfileId) ??
    index.profiles[0] ??
    createDefaultLocalOrcaProfile(Date.now())
  )
}

export function ensureActiveOrcaProfile(
  userDataPath = getProfileUserDataPath()
): ActiveOrcaProfileState {
  const indexPath = getOrcaProfileIndexPath(userDataPath)
  let index = existsSync(indexPath) ? readProfileIndex(indexPath) : null
  let shouldWriteIndex = false

  if (!index) {
    index = createInitialProfileIndex()
    shouldWriteIndex = true
  }

  const activeProfile = getActiveProfile(index)
  if (activeProfile.id !== index.activeProfileId) {
    index = { ...index, activeProfileId: activeProfile.id }
    shouldWriteIndex = true
  }

  const profileDirectory = getOrcaProfileDirectory(activeProfile.id, userDataPath)
  mkdirSync(profileDirectory, { recursive: true })
  if (activeProfile.id === DEFAULT_LOCAL_GIRRA_PROFILE_ID) {
    copyLegacyStateToProfile(userDataPath, activeProfile.id)
  }

  if (shouldWriteIndex) {
    writeProfileIndex(indexPath, index)
  }

  return {
    index,
    profile: activeProfile,
    dataFile: getOrcaProfileDataFile(activeProfile.id, userDataPath),
    profileDirectory
  }
}
