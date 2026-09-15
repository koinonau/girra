import { describe, expect, it } from 'vitest'
import { SETUP_GUIDE_STEPS, type SetupGuideStepId } from '../../../../shared/setup-guide-steps'
import { getSettingsSetupGuideProgress } from './settings-setup-guide-progress'

describe('settings setup guide progress', () => {
  function makePreBrowserDoneStepState(): Partial<Record<SetupGuideStepId, boolean>> {
    return Object.fromEntries(
      SETUP_GUIDE_STEPS.map((step) => [step.id, step.id !== 'browser'])
    ) as Partial<Record<SetupGuideStepId, boolean>>
  }

  it('tracks the full setup checklist total', () => {
    const progress = getSettingsSetupGuideProgress({
      ready: true,
      stepDone: {}
    })

    expect(progress).toEqual({
      ready: true,
      doneCount: 0,
      total: SETUP_GUIDE_STEPS.length,
      firstIncompleteStepId: 'notifications'
    })
  })

  it('does not mark Settings complete when only the old setup subset is done', () => {
    const stepDone = {
      'two-worktrees': true,
      notifications: true,
      'default-agent': true,
      'task-sources': true
    } satisfies Partial<Record<SetupGuideStepId, boolean>>

    expect(getSettingsSetupGuideProgress({ ready: true, stepDone })).toEqual({
      ready: true,
      doneCount: 4,
      total: SETUP_GUIDE_STEPS.length,
      firstIncompleteStepId: 'agent-capabilities'
    })
  })

  it('does not mark Settings complete for fresh users when only the browser step is incomplete', () => {
    expect(
      getSettingsSetupGuideProgress({
        ready: true,
        stepDone: makePreBrowserDoneStepState()
      })
    ).toEqual({
      ready: true,
      doneCount: SETUP_GUIDE_STEPS.length - 1,
      total: SETUP_GUIDE_STEPS.length,
      firstIncompleteStepId: 'browser'
    })
  })

  it('marks Settings complete when every setup guide step is done', () => {
    const stepDone = Object.fromEntries(SETUP_GUIDE_STEPS.map((step) => [step.id, true])) as Record<
      SetupGuideStepId,
      boolean
    >

    expect(getSettingsSetupGuideProgress({ ready: true, stepDone })).toEqual({
      ready: true,
      doneCount: SETUP_GUIDE_STEPS.length,
      total: SETUP_GUIDE_STEPS.length,
      firstIncompleteStepId: null
    })
  })

  it('preserves progress readiness for the sidebar row gate', () => {
    const progress = getSettingsSetupGuideProgress({
      ready: false,
      stepDone: {
        'two-worktrees': true
      }
    })

    expect(progress.ready).toBe(false)
    expect(progress.doneCount).toBe(1)
  })
})
