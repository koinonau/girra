import { app } from 'electron'
import type { AgentProviderSessionMetadata } from '../../shared/agent-session-resume'
import type { AccountSelectionTarget } from '../../shared/account-selection-target'
import type { CodexSessionResumePreparation } from '../codex/codex-session-resume-home'
import { prepareCodexSessionResume } from '../codex/codex-session-resume-preparation'
import { prepareLegacySharedCodexSessionResume } from '../codex/codex-legacy-session-resume'
import { codexHookService } from '../codex/hook-service'
import { ensureRealHomeCodexHookState } from '../codex/codex-real-home-hook-install'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { markCodexProjectTrusted } from '../agent-trust-presets'
import { getOrcaManagedCodexHomePath, getSystemCodexHomePath } from '../codex/codex-home-paths'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { mainProcessState as state } from './main-process-state'
import { isHostCodexRealHome } from './codex-launch-preparation'

export async function prepareCodexSessionResumeForLaunch(args: {
  providerSession: AgentProviderSessionMetadata
  target: AccountSelectionTarget
  launchEnv?: NodeJS.ProcessEnv
  workspacePath?: string
}): Promise<CodexSessionResumePreparation | null> {
  const store = state.store
  if (args.target.runtime === 'wsl' || !store) {
    return null
  }
  const systemHomePath = getSystemCodexHomePath()
  // Why: the retired shared mirror stays trusted so its rollouts can still migrate into ~/.codex.
  // codexSessionSourceHome is import-only; treating it as CODEX_HOME would mutate history sources.
  const trustedHomes = [systemHomePath, getOrcaManagedCodexHomePath()]
  // Why: a `fresh` outcome must skip migration, trust and hook repair entirely — there is
  // no verified origin home to prepare, so the PTY layer drops the resume argv (#10793).
  const preparation = await prepareCodexSessionResume({
    sessionId: args.providerSession.id,
    transcriptPath: args.providerSession.transcriptPath,
    trustedCodexHomes: trustedHomes,
    // Why: the legacy id rescan's winning home becomes this pane's CODEX_HOME, i.e. its account;
    // rank it by the current selection so settings insertion order can never decide the account.
    getSelectedAccountCodexHome: () => null,
    systemCodexHomePath: systemHomePath,
    // Why: the mirror winning is what triggers the migration into ~/.codex below, so it must
    // outrank the path-sorted account homes or a system-default selection resumes as an account.
    sharedRuntimeCodexHomePath: getOrcaManagedCodexHomePath(),
    resolveVerifiedResumeHome: async (sessionSource) => {
      let migrated = { useRealCodexHome: false }
      try {
        migrated = await prepareLegacySharedCodexSessionResume(
          {
            agent: 'codex',
            executionHostId: 'local',
            filePath: sessionSource.transcriptPath,
            codexHome: sessionSource.homePath
          },
          {
            isHostSystemDefaultRealHome: () => isHostCodexRealHome(),
            systemCodexHomePath: systemHomePath
          }
        )
      } catch (error) {
        // Why: migration is a compatibility repair; its failure must not prevent the PTY from resuming from its trusted origin home.
        console.warn(
          '[codex-session-resume] Legacy rollout migration failed; using origin home:',
          error
        )
      }
      const resumeHome = migrated.useRealCodexHome ? systemHomePath : sessionSource.homePath
      if (args.workspacePath) {
        try {
          await markCodexProjectTrusted(args.workspacePath)
        } catch (error) {
          console.warn('[codex-project-trust] failed to pre-mark resumed workspace:', error)
        }
      }
      const isSystemHome =
        normalizeRuntimePathForComparison(resumeHome) ===
        normalizeRuntimePathForComparison(systemHomePath)
      const hooksEnabled = isAgentStatusHooksEnabled(store.getSettings())
      try {
        if (isSystemHome) {
          await ensureRealHomeCodexHookState({
            hooksEnabled,
            userDataPath: app.getPath('userData')
          })
        } else if (hooksEnabled) {
          await codexHookService.installForLaunchPrep(resumeHome)
        } else {
          await codexHookService.refreshRuntimeUserHooksForLaunchPrep(resumeHome)
        }
      } catch (error) {
        // Why: hook repair is best-effort; session provenance must still win over the currently selected home.
        console.warn('[codex-hook-service] failed to prepare automatic resume home:', error)
      }
      return resumeHome
    }
  })
  return preparation.outcome === 'resume'
    ? {
        ...preparation,
        reconcileSharedRuntimeAuth:
          normalizeRuntimePathForComparison(preparation.codexHomePath) ===
          normalizeRuntimePathForComparison(getOrcaManagedCodexHomePath())
      }
    : preparation
}
