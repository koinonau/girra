import type { FeatureTipId } from '../../../../shared/feature-tips'
import {
  getCompletedFeatureTipIds,
  getOrderedUnseenFeatureTips
} from '../../../../shared/feature-tips'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import type { FeatureInteractionState } from '../../../../shared/feature-interactions'

export type FeatureTipsAppOpenDecision =
  | { kind: 'open'; tipId: FeatureTipId }
  | { kind: 'skip' }
  | { kind: 'suppress-for-first-run' }

export function isCliFeatureTipCompleted(status: CliInstallStatus): boolean {
  // Why: unsupported launch modes cannot complete setup, but an installed
  // launcher still needs attention until it is reachable on PATH.
  return !status.supported || (status.state === 'installed' && status.pathConfigured === true)
}

export function getFeatureTipsAppOpenDecision(args: {
  activeModal: string
  cliInstalled: boolean | null
  featureTipsSeenIds: readonly FeatureTipId[]
  featureInteractions: FeatureInteractionState
  persistedUIReady: boolean
  workspaceSessionReady: boolean
  hasProjects: boolean
  promptedThisSession: boolean
  suppressedForFirstRunThisSession: boolean
}): FeatureTipsAppOpenDecision {
  if (
    args.promptedThisSession ||
    args.suppressedForFirstRunThisSession ||
    !args.persistedUIReady ||
    !args.workspaceSessionReady
  ) {
    return { kind: 'skip' }
  }

  // Why: a profile with no projects is on its first run; let it add one without an education modal.
  if (!args.hasProjects) {
    return { kind: 'suppress-for-first-run' }
  }

  if (args.activeModal !== 'none' || args.cliInstalled === null) {
    return { kind: 'skip' }
  }

  const unseenTips = getOrderedUnseenFeatureTips({
    seenTipIds: new Set<FeatureTipId>(args.featureTipsSeenIds),
    completedTipIds: getCompletedFeatureTipIds({
      cliInstalled: args.cliInstalled,
      featureInteractions: args.featureInteractions
    })
  })

  const nextTip = unseenTips[0]
  return nextTip ? { kind: 'open', tipId: nextTip.id } : { kind: 'skip' }
}
