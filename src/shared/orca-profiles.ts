import { ORCA_BROWSER_PARTITION } from './constants'

export const ORCA_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_ORCA_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_ORCA_PROFILE_NAME = 'Personal'
/** Main -> renderer push when the stored auth status changed without the renderer asking. */
const LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX = 'persist:orca-browser-session-'

export type OrcaProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type OrcaProfileKind = 'local' | 'cloud-linked'

export type OrcaProfileCloudSummary = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId?: string
  activeOrgName?: string
  linkedAt: number
}

export type OrcaProfileSummary = {
  id: string
  name: string
  avatar: OrcaProfileAvatar
  kind: OrcaProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  cloud?: OrcaProfileCloudSummary
}

export type OrcaProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: OrcaProfileSummary[]
}

export function createDefaultLocalOrcaProfile(now: number): OrcaProfileSummary {
  return {
    id: DEFAULT_LOCAL_ORCA_PROFILE_ID,
    name: DEFAULT_LOCAL_ORCA_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getOrcaProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getOrcaProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_ORCA_PROFILE_ID) {
    return ORCA_BROWSER_PARTITION
  }
  return `persist:orca-profile-${getOrcaProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getOrcaProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_ORCA_PROFILE_ID) {
    return `${LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:orca-profile-${getOrcaProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}
