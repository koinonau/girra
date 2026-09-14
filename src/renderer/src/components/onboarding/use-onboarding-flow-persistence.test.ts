// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultOnboardingState } from '../../../../shared/constants'
import type { OnboardingState } from '../../../../shared/onboarding-state-types'

import { buildCompletedOnboardingNotificationSettings } from './use-onboarding-flow-persistence'

function makeOnboardingState(): OnboardingState {
  return {
    ...getDefaultOnboardingState(),
    closedAt: Date.now(),
    outcome: 'completed',
    lastCompletedStep: 5
  }
}

function setApi(api: { onboarding: { update: ReturnType<typeof vi.fn> } }): void {
  ;(window as unknown as { api: typeof api }).api = api
}

describe('onboarding flow persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setApi({
      onboarding: { update: vi.fn().mockResolvedValue(makeOnboardingState()) }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves explicit focus notification suppression when completing onboarding', () => {
    const notifications = buildCompletedOnboardingNotificationSettings({
      enabled: false,
      agentTaskComplete: false,
      terminalBell: false,
      suppressWhenFocused: false,
      customSoundId: 'two-tone',
      customSoundPath: null,
      customSoundVolume: 60
    })

    expect(notifications).toEqual({
      enabled: true,
      agentTaskComplete: true,
      terminalBell: true,
      suppressWhenFocused: false,
      customSoundId: 'two-tone',
      customSoundPath: null,
      customSoundVolume: 60
    })
  })
})
