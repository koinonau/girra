import type { NotificationSettings } from '../../../shared/notification-settings-types'
import { getDefaultNotificationSettings } from '../../../shared/constants'

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const defaults = getDefaultNotificationSettings()
  const candidate =
    value && typeof value === 'object' ? (value as Partial<NotificationSettings>) : {}
  const rawSoundId = (candidate as { customSoundId?: unknown }).customSoundId
  const customSoundId =
    rawSoundId === 'system' ||
    rawSoundId === 'two-tone' ||
    rawSoundId === 'bong' ||
    rawSoundId === 'thump' ||
    rawSoundId === 'blip' ||
    rawSoundId === 'sonar' ||
    rawSoundId === 'blop' ||
    rawSoundId === 'ding' ||
    rawSoundId === 'clack' ||
    rawSoundId === 'beep' ||
    rawSoundId === 'custom'
      ? rawSoundId
      : rawSoundId === 'orca' || rawSoundId === 'chime'
        ? 'two-tone'
        : rawSoundId === 'pop'
          ? 'blop'
          : typeof candidate.customSoundPath === 'string'
            ? 'custom'
            : defaults.customSoundId
  const rawVolume = candidate.customSoundVolume
  const customSoundVolume =
    typeof rawVolume === 'number' && Number.isFinite(rawVolume)
      ? Math.min(100, Math.max(0, rawVolume))
      : defaults.customSoundVolume
  // Why field-by-field: a blanket spread let a type-flipped value on disk through, so `enabled: "false"`
  // stayed truthy and `customSoundPath: 42` reached the sound loader.
  const booleanOr = (raw: unknown, fallback: boolean): boolean =>
    typeof raw === 'boolean' ? raw : fallback
  return {
    enabled: booleanOr(candidate.enabled, defaults.enabled),
    agentTaskComplete: booleanOr(candidate.agentTaskComplete, defaults.agentTaskComplete),
    terminalBell: booleanOr(candidate.terminalBell, defaults.terminalBell),
    suppressWhenFocused: booleanOr(candidate.suppressWhenFocused, defaults.suppressWhenFocused),
    customSoundId,
    customSoundPath:
      typeof candidate.customSoundPath === 'string'
        ? candidate.customSoundPath
        : defaults.customSoundPath,
    customSoundVolume
  }
}

/**
 * Whether normalization had to repair the persisted notification block. Callers use this to mark the
 * load dirty; an in-memory-only repair is redone on every launch until some other write lands.
 * A missing block is not a repair — nothing on disk was overridden.
 */
export function persistedNotificationSettingsRepaired(
  value: unknown,
  normalized: NotificationSettings
): boolean {
  if (value === undefined) {
    return false
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return true
  }
  const raw = value as Record<string, unknown>
  return Object.entries(normalized).some(([key, normalizedValue]) => raw[key] !== normalizedValue)
}
