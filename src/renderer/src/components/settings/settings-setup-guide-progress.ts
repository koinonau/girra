import { useMemo } from 'react'
import {
  SETUP_GUIDE_STEPS,
  getFirstIncompleteSetupGuideStepId,
  type SetupGuideStepId
} from '../../../../shared/setup-guide-steps'
import type { SetupGuideProgress } from '../setup-guide/setup-guide-progress'
import { useSetupGuideProgress } from '../setup-guide/use-setup-guide-progress'

export type SettingsSetupGuideProgress = {
  ready: boolean
  doneCount: number
  total: number
  firstIncompleteStepId: SetupGuideStepId | null
}

export function getSettingsSetupGuideProgress(progress: {
  ready: boolean
  stepDone: Partial<Record<SetupGuideStepId, boolean>>
}): SettingsSetupGuideProgress {
  const doneCount = SETUP_GUIDE_STEPS.filter((step) => progress.stepDone[step.id]).length
  const firstIncompleteStepId =
    doneCount === SETUP_GUIDE_STEPS.length
      ? null
      : getFirstIncompleteSetupGuideStepId(progress.stepDone)

  return {
    ready: progress.ready,
    doneCount,
    total: SETUP_GUIDE_STEPS.length,
    firstIncompleteStepId
  }
}

export function useSettingsSetupGuideProgress(
  shouldRefreshCoreState: boolean
): SettingsSetupGuideProgress {
  const fullProgress = useSettingsSetupGuideFullProgress(shouldRefreshCoreState, false, false)

  return useMemo(() => getSettingsSetupGuideProgress(fullProgress), [fullProgress])
}

export function useSettingsSetupGuideFullProgress(
  shouldRefreshCoreState: boolean,
  orchestrationSkillInstalled: boolean,
  browserUseSkillInstalled: boolean
): SetupGuideProgress {
  return useSetupGuideProgress(
    shouldRefreshCoreState,
    orchestrationSkillInstalled,
    browserUseSkillInstalled
  )
}
