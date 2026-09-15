import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { SETUP_GUIDE_STEPS, type SetupGuideStepId } from '../../../../shared/setup-guide-steps'
import type { SetupGuideProgress } from './setup-guide-progress'

export function useSetupGuideBrowserMilestoneProgress(
  rawProgress: SetupGuideProgress,
  historicalSplitTerminalDone: boolean
): SetupGuideProgress {
  const setupGuideSidebarDismissed = useAppStore((s) => s.setupGuideSidebarDismissed)
  const browserMilestoneMigrated = useAppStore((s) => s.setupGuideBrowserMilestoneMigrated)
  const browserMilestoneLegacyComplete = useAppStore(
    (s) => s.setupGuideBrowserMilestoneLegacyComplete
  )
  const markBrowserMilestoneMigrated = useAppStore((s) => s.markSetupGuideBrowserMilestoneMigrated)
  const pendingLegacyComplete =
    !browserMilestoneMigrated && rawProgress.ready
      ? shouldMarkBrowserMilestoneLegacyComplete({
          stepDone: rawProgress.stepDone,
          historicalSplitTerminalDone,
          setupGuideSidebarDismissed
        })
      : false
  const effectiveLegacyComplete = browserMilestoneLegacyComplete || pendingLegacyComplete

  useEffect(() => {
    if (browserMilestoneMigrated || !rawProgress.ready) {
      return
    }
    markBrowserMilestoneMigrated(pendingLegacyComplete)
  }, [
    browserMilestoneMigrated,
    markBrowserMilestoneMigrated,
    pendingLegacyComplete,
    rawProgress.ready
  ])

  return useMemo(
    () => getSetupGuideBrowserMilestoneAwareProgress(rawProgress, effectiveLegacyComplete),
    [effectiveLegacyComplete, rawProgress]
  )
}

export function shouldMarkBrowserMilestoneLegacyComplete(input: {
  stepDone: Partial<Record<SetupGuideStepId, boolean>>
  historicalSplitTerminalDone: boolean
  setupGuideSidebarDismissed: boolean
}): boolean {
  if (input.setupGuideSidebarDismissed) {
    return true
  }
  // Why: browser migration preserves the old pre-browser checklist, which
  // included the now-removed split-terminal milestone.
  return (
    input.historicalSplitTerminalDone &&
    SETUP_GUIDE_STEPS.every((step) => step.id === 'browser' || input.stepDone[step.id])
  )
}

export function getSetupGuideBrowserMilestoneAwareProgress(
  progress: SetupGuideProgress,
  browserMilestoneLegacyComplete: boolean
): SetupGuideProgress {
  if (!browserMilestoneLegacyComplete) {
    return progress
  }
  const stepDone = Object.fromEntries(SETUP_GUIDE_STEPS.map((step) => [step.id, true])) as Record<
    SetupGuideStepId,
    boolean
  >
  // Why: profiles that finished or dismissed the pre-browser checklist keep
  // that prior checklist contract after the browser milestone is introduced.
  return {
    ...progress,
    stepDone,
    coreDoneCount: SETUP_GUIDE_STEPS.length,
    coreTotal: SETUP_GUIDE_STEPS.length
  }
}
